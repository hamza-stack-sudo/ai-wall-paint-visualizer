# improved_sam_visualizer.py - FIXED VERSION
import cv2
import numpy as np
from typing import List, Tuple, Optional
import os
from dataclasses import dataclass
from segment_anything import sam_model_registry, SamPredictor, SamAutomaticMaskGenerator
import torch

@dataclass
class WallSegment:
    mask: np.ndarray
    area: int
    bbox: Tuple[int, int, int, int]
    confidence: float
    wall_type: str

class ImprovedWallPaintVisualizer:
    def __init__(self, sam_checkpoint_path: str, model_type: str = "vit_h"):
        self.sam_checkpoint = sam_checkpoint_path
        self.model_type = model_type
        self.sam = None
        self.predictor = None
        self.mask_generator = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        self._load_model()
    
    def _load_model(self):
        """Load SAM model optimized for wall detection"""
        try:
            print(f"Loading SAM model from: {self.sam_checkpoint}")
            if not os.path.exists(self.sam_checkpoint):
                raise FileNotFoundError(f"SAM checkpoint not found: {self.sam_checkpoint}")
            
            self.sam = sam_model_registry[self.model_type](checkpoint=self.sam_checkpoint)
            self.sam.to(device=self.device)
            self.predictor = SamPredictor(self.sam)
            
            # Optimized settings for wall detection
            self.mask_generator = SamAutomaticMaskGenerator(
                model=self.sam,
                points_per_side=32,
                pred_iou_thresh=0.75,
                stability_score_thresh=0.9,
                crop_n_layers=1,
                min_mask_region_area=1000,
                box_nms_thresh=0.6,
            )
            print("SAM model loaded successfully")
        except Exception as e:
            print(f"Error loading SAM model: {e}")
            raise
    
    def preprocess_image(self, image: np.ndarray, max_size: int = 1024) -> Tuple[np.ndarray, float]:
        """Enhanced preprocessing - ensures RGB format"""
        # Convert BGR to RGB if needed
        if len(image.shape) == 3 and image.shape[2] == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Apply slight blur to reduce noise
        image = cv2.GaussianBlur(image, (3, 3), 0)
        
        # Enhance contrast
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8)).apply(l)
        image = cv2.merge([l, a, b])
        image = cv2.cvtColor(image, cv2.COLOR_LAB2RGB)
        
        # Scale if needed
        h, w = image.shape[:2]
        scale_factor = 1.0
        if max(h, w) > max_size:
            scale_factor = max_size / max(h, w)
            new_w, new_h = int(w * scale_factor), int(h * scale_factor)
            image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        
        print(f"Preprocessed to RGB: {image.shape}, scale: {scale_factor:.3f}")
        return image, scale_factor
    
    def classify_wall_advanced(self, mask: np.ndarray, bbox: Tuple[int, int, int, int], 
                              image_shape: Tuple[int, int]) -> Tuple[str, float]:
        """STRICT wall classification - only large vertical/horizontal surfaces"""
        x, y, w, h = bbox
        img_h, img_w = image_shape[:2]
        
        area_ratio = (w * h) / (img_w * img_h)
        aspect_ratio = max(w, h) / max(min(w, h), 1)
        position_x = (x + w/2) / img_w
        position_y = (y + h/2) / img_h
        
        edge_margin = 30
        touches_left = x <= edge_margin
        touches_right = (x + w) >= (img_w - edge_margin)
        touches_top = y <= edge_margin
        touches_bottom = (y + h) >= (img_h - edge_margin)
        
        score = 0
        wall_type = "background"
        
        # STRICT Main wall criteria - must be LARGE and touch edges
        if (area_ratio > 0.20 and aspect_ratio < 3.5 and 
            (touches_left or touches_right) and 
            h > img_h * 0.4):  # Must be at least 40% of image height
            wall_type = "main_wall"
            score = 0.95
        
        # Accent wall - still large but may not touch edges
        elif (area_ratio > 0.12 and aspect_ratio < 4 and 
              0.15 < position_x < 0.85 and position_y < 0.75 and
              h > img_h * 0.3):
            wall_type = "accent_wall" 
            score = 0.75
            
        # Reject small segments (likely furniture/objects)
        elif area_ratio < 0.08:
            return "rejected", 0.0
        
        return wall_type, score
    
    def detect_walls_improved(self, image: np.ndarray) -> Tuple[List[WallSegment], float]:
        """Improved wall detection with better classification"""
        if self.mask_generator is None:
            raise RuntimeError("SAM mask generator not initialized")
            
        processed_image, scale_factor = self.preprocess_image(image)
        print(f"Generating masks for image shape: {processed_image.shape}")
        
        try:
            masks = self.mask_generator.generate(processed_image)
            print(f"Generated {len(masks)} masks")
        except Exception as e:
            print(f"Error generating masks: {e}")
            return [], scale_factor
        
        wall_segments = []
        
        for i, mask_data in enumerate(masks):
            try:
                mask = mask_data['segmentation']
                if hasattr(mask, 'cpu'):
                    mask = mask.cpu().numpy()
                
                bbox_raw = mask_data['bbox']
                if len(bbox_raw) >= 4:
                    bbox = (int(bbox_raw[0]), int(bbox_raw[1]), int(bbox_raw[2]), int(bbox_raw[3]))
                else:
                    continue
                
                area = int(mask.sum())
                confidence = mask_data['stability_score']
                
                if hasattr(confidence, 'item'):
                    confidence = confidence.item()
                else:
                    confidence = float(confidence)
                
                wall_type, wall_score = self.classify_wall_advanced(mask, bbox, processed_image.shape)
                
                if wall_score >= 0.5:
                    wall_segment = WallSegment(
                        mask=mask.astype(bool),
                        area=area,
                        bbox=bbox,
                        confidence=confidence * wall_score,
                        wall_type=wall_type
                    )
                    wall_segments.append(wall_segment)
                    
            except Exception as e:
                print(f"Error processing mask {i}: {e}")
                continue
        
        # Sort by importance
        wall_segments.sort(key=lambda x: (
            3 if x.wall_type == "main_wall" else 2 if x.wall_type == "accent_wall" else 1,
            x.area * x.confidence
        ), reverse=True)
        
        print(f"Found {len(wall_segments)} valid wall segments")
        for i, seg in enumerate(wall_segments[:5]):
            print(f"  Wall {i}: type={seg.wall_type}, area={seg.area}, conf={seg.confidence:.2f}")
        
        return wall_segments, scale_factor
    
    def resize_masks_to_original(self, wall_segments: List[WallSegment], 
                                original_shape: Tuple[int, int], scale_factor: float) -> List[WallSegment]:
        """FIXED: Resize masks back to original dimensions with proper interpolation"""
        if scale_factor == 1.0:
            print("No resizing needed (scale_factor = 1.0)")
            return wall_segments
        
        resized_segments = []
        original_h, original_w = original_shape[:2]
        
        print(f"\nResizing masks to original size: {original_w}x{original_h}, scale: {scale_factor}")
        
        for idx, segment in enumerate(wall_segments):
            try:
                # Convert boolean mask to uint8
                mask_uint8 = (segment.mask * 255).astype(np.uint8)
                
                # Resize with INTER_LINEAR for better quality
                resized_mask = cv2.resize(
                    mask_uint8, 
                    (original_w, original_h), 
                    interpolation=cv2.INTER_LINEAR
                )
                
                # Convert back to boolean with threshold
                resized_mask_bool = (resized_mask > 127).astype(bool)
                
                # Calculate new area
                new_area = int(resized_mask_bool.sum())
                
                # Scale bbox coordinates
                x, y, w, h = segment.bbox
                new_bbox = (
                    int(x / scale_factor),
                    int(y / scale_factor),
                    int(w / scale_factor), 
                    int(h / scale_factor)
                )
                
                print(f"  Wall {idx}: Original area={segment.area}, New area={new_area}, pixels={new_area}")
                
                if new_area > 0:
                    resized_segment = WallSegment(
                        mask=resized_mask_bool,
                        area=new_area,
                        bbox=new_bbox,
                        confidence=segment.confidence,
                        wall_type=segment.wall_type
                    )
                    resized_segments.append(resized_segment)
                else:
                    print(f"  Wall {idx}: SKIPPED (empty mask after resize)")
                
            except Exception as e:
                print(f"  Wall {idx}: ERROR resizing - {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"Successfully resized {len(resized_segments)}/{len(wall_segments)} masks\n")
        return resized_segments
    
    def apply_smart_paint(self, image: np.ndarray, wall_segments: List[WallSegment], 
                         color: Tuple[int, int, int], opacity: float = 0.7,
                         paint_main_walls_only: bool = False) -> np.ndarray:
        """FIXED: Smart paint application with proper color handling"""
        if not wall_segments:
            print("WARNING: No wall segments to paint")
            return image
        
        # Ensure RGB format
        if len(image.shape) == 3 and image.shape[2] == 3:
            result_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            result_image = image.copy()
        
        print(f"\nPaint Application:")
        print(f"  Image shape: {result_image.shape}")
        print(f"  Color RGB: {color}")
        print(f"  Opacity: {opacity}")
        
        # Ensure color is RGB tuple
        color_rgb = np.array([int(color[0]), int(color[1]), int(color[2])], dtype=np.float32)
        
        # Filter walls
        walls_to_paint = wall_segments
        if paint_main_walls_only:
            walls_to_paint = [w for w in wall_segments if w.wall_type == "main_wall"]
            print(f"  Filtering to main walls only: {len(walls_to_paint)} walls")
        
        if not walls_to_paint:
            print("  WARNING: No walls match filter criteria")
            return cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR)
        
        print(f"  Painting {len(walls_to_paint)} walls\n")
        
        painted_count = 0
        for idx, wall_segment in enumerate(walls_to_paint):
            try:
                # Ensure mask dimensions match image
                if wall_segment.mask.shape[:2] != result_image.shape[:2]:
                    print(f"  Wall {idx}: DIMENSION MISMATCH!")
                    print(f"    Mask shape: {wall_segment.mask.shape}")
                    print(f"    Image shape: {result_image.shape}")
                    continue
                
                mask_bool = wall_segment.mask.astype(bool)
                num_pixels = np.sum(mask_bool)
                
                if num_pixels == 0:
                    print(f"  Wall {idx}: Empty mask, skipping")
                    continue
                
                print(f"  Wall {idx}: Painting {num_pixels:,} pixels ({wall_segment.wall_type})")
                
                # Get wall pixels
                wall_pixels = result_image[mask_bool].astype(np.float32)
                
                # Calculate brightness for adjustment
                wall_gray = cv2.cvtColor(
                    wall_pixels.reshape(-1, 1, 3).astype(np.uint8), 
                    cv2.COLOR_RGB2GRAY
                )
                avg_brightness = np.mean(wall_gray)
                brightness_factor = np.clip(avg_brightness / 128.0, 0.7, 1.3)
                
                # Adjust color based on brightness
                adjusted_color = color_rgb * brightness_factor
                adjusted_color = np.clip(adjusted_color, 0, 255)
                
                # Adjust opacity by wall type
                wall_opacity = opacity
                if wall_segment.wall_type == "accent_wall":
                    wall_opacity *= 0.9
                elif wall_segment.wall_type == "background":
                    wall_opacity *= 0.6
                
                # Apply paint: result = original * (1 - alpha) + color * alpha
                result_image[mask_bool] = (
                    wall_pixels * (1.0 - wall_opacity) + 
                    adjusted_color * wall_opacity
                ).astype(np.uint8)
                
                painted_count += 1
                print(f"    ✓ SUCCESS (opacity: {wall_opacity:.2f}, brightness: {avg_brightness:.1f})")
                
            except Exception as e:
                print(f"    ✗ ERROR: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"\nPaint Summary: {painted_count}/{len(walls_to_paint)} walls painted successfully\n")
        
        # Convert back to BGR for OpenCV
        result_bgr = cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR)
        return result_bgr
    
    def create_mask_visualization(self, image: np.ndarray, wall_segments: List[WallSegment], 
                                  scale_factor: float = 1.0) -> np.ndarray:
        """Create visualization showing detected masks"""
        vis_image = image.copy()
        
        # Convert to RGB for processing
        if len(vis_image.shape) == 3:
            vis_image = cv2.cvtColor(vis_image, cv2.COLOR_BGR2RGB)
        
        colors = [
            (255, 0, 0),    # Red
            (0, 255, 0),    # Green
            (0, 0, 255),    # Blue
            (255, 255, 0),  # Yellow
            (255, 0, 255),  # Magenta
        ]
        
        for idx, segment in enumerate(wall_segments[:5]):
            color = colors[idx % len(colors)]
            
            # Resize mask to match image if needed
            if segment.mask.shape[:2] != vis_image.shape[:2]:
                mask_resized = cv2.resize(
                    (segment.mask * 255).astype(np.uint8),
                    (vis_image.shape[1], vis_image.shape[0]),
                    interpolation=cv2.INTER_LINEAR
                ) > 127
            else:
                mask_resized = segment.mask
            
            # Blend color with image
            vis_image[mask_resized] = (
                vis_image[mask_resized].astype(np.float32) * 0.5 +
                np.array(color, dtype=np.float32) * 0.5
            ).astype(np.uint8)
        
        # Convert back to BGR
        return cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR)