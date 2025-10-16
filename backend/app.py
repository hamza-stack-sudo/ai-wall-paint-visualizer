# app.py - WITH GPU/CPU AUTO-DETECTION & MASK CACHING
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import os
import logging
from datetime import datetime
import traceback
import hashlib
import torch

from improved_sam_visualizer import ImprovedWallPaintVisualizer

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'change-this-to-random-string-in-production')

# CORS Configuration
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
UPLOAD_FOLDER = 'temp_uploads'
RESULTS_FOLDER = 'results'
SAM_CHECKPOINT = 'models/sam_vit_h_4b8939.pth'

# Create necessary directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)
os.makedirs('models', exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global variables
visualizer = None
device_info = {
    'type': 'unknown',
    'name': 'unknown',
    'available': False
}

# In-memory cache for masks
mask_cache = {}

def detect_device():
    """Detect available device (GPU/CPU) and log details"""
    global device_info
    
    logger.info("=" * 60)
    logger.info("🔍 DEVICE DETECTION")
    logger.info("=" * 60)
    
    # Check CUDA availability
    cuda_available = torch.cuda.is_available()
    
    if cuda_available:
        device_info['type'] = 'cuda'
        device_info['available'] = True
        device_info['name'] = torch.cuda.get_device_name(0)
        device_info['memory'] = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"
        device_info['cuda_version'] = torch.version.cuda
        
        logger.info("✅ GPU DETECTED!")
        logger.info(f"   Device: {device_info['name']}")
        logger.info(f"   Memory: {device_info['memory']}")
        logger.info(f"   CUDA Version: {device_info['cuda_version']}")
        logger.info("   🚀 Processing will be FAST!")
        
    else:
        device_info['type'] = 'cpu'
        device_info['available'] = True
        device_info['name'] = 'CPU'
        device_info['cores'] = os.cpu_count()
        
        logger.info("⚠️  NO GPU DETECTED - Using CPU")
        logger.info(f"   CPU Cores: {device_info['cores']}")
        logger.info("   ⏱️  Processing will be SLOWER (20-30 seconds per image)")
        logger.info("   💡 TIP: Use smaller images for faster results")
    
    logger.info("=" * 60)
    logger.info("")
    
    return device_info['type']

def get_image_hash(image_data: str) -> str:
    """Generate unique hash for image"""
    return hashlib.md5(image_data.encode()).hexdigest()[:16]

def initialize_visualizer():
    """Initialize SAM visualizer with auto device detection"""
    global visualizer
    
    try:
        # First check if model file exists
        if not os.path.exists(SAM_CHECKPOINT):
            logger.error("=" * 60)
            logger.error("❌ SAM MODEL NOT FOUND!")
            logger.error("=" * 60)
            logger.error(f"Expected location: {SAM_CHECKPOINT}")
            logger.error("")
            logger.error("📥 DOWNLOAD INSTRUCTIONS:")
            logger.error("1. Visit: https://github.com/facebookresearch/segment-anything")
            logger.error("2. Download: sam_vit_h_4b8939.pth (2.5GB)")
            logger.error("3. Place in: backend/models/")
            logger.error("")
            logger.error("OR run: python download_model.py")
            logger.error("=" * 60)
            return False
        
        # Detect device
        device = detect_device()
        
        # Initialize visualizer
        logger.info(f"🔄 Loading SAM model from: {SAM_CHECKPOINT}")
        logger.info(f"📦 Model size: ~2.5GB")
        logger.info("⏳ This may take 10-30 seconds...")
        
        visualizer = ImprovedWallPaintVisualizer(SAM_CHECKPOINT)
        
        logger.info("=" * 60)
        logger.info("✅ SAM VISUALIZER READY!")
        logger.info("=" * 60)
        logger.info(f"   Device: {device_info['name']}")
        logger.info(f"   Status: Initialized")
        logger.info("=" * 60)
        logger.info("")
        
        return True
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error("❌ INITIALIZATION FAILED!")
        logger.error("=" * 60)
        logger.error(f"Error: {str(e)}")
        logger.error("")
        logger.error(traceback.format_exc())
        logger.error("=" * 60)
        return False

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint with device info"""
    
    response_data = {
        'status': 'healthy',
        'sam_loaded': visualizer is not None,
        'timestamp': datetime.now().isoformat(),
        'model_path': SAM_CHECKPOINT,
        'model_exists': os.path.exists(SAM_CHECKPOINT),
        'cached_images': len(mask_cache),
        'device': device_info,
        'pytorch_version': torch.__version__,
        'cuda_available': torch.cuda.is_available()
    }
    
    logger.info(f"Health check - SAM: {response_data['sam_loaded']}, Device: {device_info['type']}")
    
    return jsonify(response_data)

@app.route('/api/detect-walls', methods=['POST', 'OPTIONS'])
def detect_walls_only():
    """Detect walls ONCE and cache the results"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        if visualizer is None:
            return jsonify({
                'error': 'SAM model not loaded. Check logs for details.',
                'success': False,
                'model_exists': os.path.exists(SAM_CHECKPOINT)
            }), 500

        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided', 'success': False}), 400

        image_data = data['image']
        if 'base64,' in image_data:
            image_data_clean = image_data.split('base64,')[1]
        else:
            image_data_clean = image_data
        
        # Generate hash for this image
        image_hash = get_image_hash(image_data_clean)
        
        # Check if already processed
        if image_hash in mask_cache:
            logger.info(f"🎯 CACHE HIT! Using cached masks for image {image_hash}")
            cached_data = mask_cache[image_hash]
            
            return jsonify({
                'success': True,
                'walls_detected': len(cached_data['wall_info']),
                'wall_info': cached_data['wall_info'],
                'image_size': cached_data['image_size'],
                'image_hash': image_hash,
                'from_cache': True,
                'device_used': device_info['type']
            })
        
        # New image - process it
        logger.info(f"🔍 NEW IMAGE - Processing detection for {image_hash}")
        logger.info(f"   Device: {device_info['name']}")
        
        if device_info['type'] == 'cpu':
            logger.info("   ⏱️  CPU mode: This will take 20-30 seconds...")
        
        # Decode image
        image_bytes = base64.b64decode(image_data_clean)
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({'error': 'Could not decode image', 'success': False}), 400

        logger.info(f"   Image shape: {image.shape}")
        
        # Detect walls
        start_time = datetime.now()
        wall_segments, scale_factor = visualizer.detect_walls_improved(image)
        detection_time = (datetime.now() - start_time).total_seconds()
        
        logger.info(f"✅ Detection complete in {detection_time:.2f}s")
        logger.info(f"   Found {len(wall_segments)} wall segments")
        
        if wall_segments:
            resized_segments = visualizer.resize_masks_to_original(
                wall_segments, image.shape, scale_factor
            )
            
            wall_info = [{
                'id': i,
                'area': int(segment.area),
                'confidence': float(segment.confidence),
                'wall_type': segment.wall_type,
                'bbox': [int(x) for x in segment.bbox],
                'area_percentage': float((segment.area / (image.shape[0] * image.shape[1])) * 100)
            } for i, segment in enumerate(resized_segments)]
            
            # Cache the masks
            mask_cache[image_hash] = {
                'wall_segments': resized_segments,
                'original_image': image,
                'wall_info': wall_info,
                'image_size': {'width': image.shape[1], 'height': image.shape[0]},
                'timestamp': datetime.now().isoformat(),
                'detection_time': detection_time
            }
            
            logger.info(f"💾 Cached {len(resized_segments)} masks for image {image_hash}")
        else:
            wall_info = []
            logger.warning("⚠️  No walls detected in image")

        return jsonify({
            'success': True,
            'walls_detected': len(wall_info),
            'wall_info': wall_info,
            'image_size': {'width': image.shape[1], 'height': image.shape[0]},
            'image_hash': image_hash,
            'from_cache': False,
            'processing_time': detection_time,
            'device_used': device_info['type']
        })

    except Exception as e:
        logger.error(f"❌ Detection error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'error': f'Detection failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/paint-instant', methods=['POST', 'OPTIONS'])
def paint_instant():
    """⚡ INSTANT painting using cached masks"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        if visualizer is None:
            return jsonify({'error': 'SAM model not loaded', 'success': False}), 500

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided', 'success': False}), 400

        image_hash = data.get('image_hash')
        if not image_hash or image_hash not in mask_cache:
            return jsonify({
                'error': 'Image not found in cache. Please detect walls first.',
                'success': False
            }), 400

        selected_wall_ids = data.get('wall_ids', [])
        color_hex = data.get('color', '#FF5733')
        opacity = float(data.get('opacity', 0.7))
        main_walls_only = data.get('mainWallsOnly', False)

        logger.info(f"⚡ INSTANT PAINT: color={color_hex}, opacity={opacity}, walls={len(selected_wall_ids)}")

        # Get cached data
        cached_data = mask_cache[image_hash]
        image = cached_data['original_image']
        wall_segments = cached_data['wall_segments']

        # Convert hex to RGB
        try:
            color_hex = color_hex.lstrip('#')
            if len(color_hex) == 6:
                r = int(color_hex[0:2], 16)
                g = int(color_hex[2:4], 16)
                b = int(color_hex[4:6], 16)
                color_rgb = (r, g, b)
            else:
                color_rgb = (255, 87, 51)
        except:
            color_rgb = (255, 87, 51)

        # Filter walls
        if selected_wall_ids:
            walls_to_paint = [wall_segments[i] for i in selected_wall_ids 
                            if i < len(wall_segments)]
        else:
            walls_to_paint = wall_segments

        if not walls_to_paint:
            return jsonify({
                'error': 'No valid walls to paint',
                'success': False
            }), 400
        
        # Apply paint instantly
        start_time = datetime.now()
        painted_image = visualizer.apply_smart_paint(
            image.copy(), walls_to_paint, color_rgb, opacity, main_walls_only
        )
        paint_time = (datetime.now() - start_time).total_seconds()
        
        # Encode result
        _, encoded_img = cv2.imencode('.jpg', painted_image, 
                                    [cv2.IMWRITE_JPEG_QUALITY, 95])
        result_base64 = base64.b64encode(encoded_img.tobytes()).decode('utf-8')
        result_data_url = f"data:image/jpeg;base64,{result_base64}"
        
        logger.info(f"✅ Paint complete in {paint_time:.3f}s")
        
        return jsonify({
            'success': True,
            'result_image': result_data_url,
            'walls_painted': len(walls_to_paint),
            'processing_time': paint_time,
            'from_cache': True
        })

    except Exception as e:
        logger.error(f"❌ Painting error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'error': f'Painting failed: {str(e)}',
            'success': False
        }), 500

@app.route('/api/visualize-masks', methods=['POST', 'OPTIONS'])
def visualize_masks():
    """Show detected masks using cached data"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        if visualizer is None:
            return jsonify({'error': 'SAM model not loaded', 'success': False}), 500

        data = request.get_json()
        image_hash = data.get('image_hash')
        
        if image_hash and image_hash in mask_cache:
            logger.info(f"📊 Creating mask visualization from cache")
            cached_data = mask_cache[image_hash]
            image = cached_data['original_image']
            wall_segments = cached_data['wall_segments']
            
            vis_image = visualizer.create_mask_visualization(image, wall_segments, 1.0)
            
            _, encoded = cv2.imencode('.jpg', vis_image, [cv2.IMWRITE_JPEG_QUALITY, 95])
            result_base64 = base64.b64encode(encoded.tobytes()).decode('utf-8')
            
            return jsonify({
                'success': True,
                'visualization': f"data:image/jpeg;base64,{result_base64}",
                'walls_found': len(wall_segments),
                'from_cache': True
            })
        
        return jsonify({
            'success': False,
            'error': 'Image not found in cache'
        }), 400
        
    except Exception as e:
        logger.error(f"❌ Visualization error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/api/clear-cache', methods=['POST', 'OPTIONS'])
def clear_cache():
    """Clear mask cache"""
    if request.method == 'OPTIONS':
        return '', 204
    
    global mask_cache
    cache_size = len(mask_cache)
    mask_cache = {}
    logger.info(f"🗑️  Cache cleared ({cache_size} images removed)")
    
    return jsonify({
        'success': True,
        'message': f'Cleared {cache_size} cached images'
    })

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🎨 AI WALL PAINT VISUALIZER - GPU/CPU AUTO-DETECTION")
    print("="*70)
    
    if initialize_visualizer():
        print(f"\n✅ SERVER READY!")
        print(f"   URL: http://localhost:5000")
        print(f"   Device: {device_info['name']} ({device_info['type'].upper()})")
        print(f"   CORS: Enabled for localhost:3000")
        print(f"   Cache: Enabled")
        
        print(f"\n📡 API ENDPOINTS:")
        print(f"   GET  /api/health           - Check status")
        print(f"   POST /api/detect-walls     - Detect & cache (slow)")
        print(f"   POST /api/paint-instant    - Paint instantly (fast)")
        print(f"   POST /api/visualize-masks  - Show masks")
        print(f"   POST /api/clear-cache      - Clear cache")
        
        if device_info['type'] == 'cpu':
            print(f"\n⚠️  CPU MODE ACTIVE")
            print(f"   • Detection: ~20-30 seconds per image")
            print(f"   • Painting: Instant (< 1 second)")
            print(f"   • Tip: Use images < 1024px for faster results")
        else:
            print(f"\n🚀 GPU MODE ACTIVE")
            print(f"   • Detection: ~5-10 seconds per image")
            print(f"   • Painting: Instant (< 0.5 seconds)")
        
        print("\n" + "="*70)
        print("💡 TIP: Detect walls once, then change colors instantly!")
        print("="*70 + "\n")
        
        app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
    else:
        print("\n❌ SERVER FAILED TO START")
        print("="*70)
        print("Please check the error messages above.")
        print("="*70 + "\n")