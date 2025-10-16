<div align="center">

# 🎨 AI Wall Paint Visualizer

### Transform your room with AI-powered instant color visualization

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-18.0+-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![SAM](https://img.shields.io/badge/SAM-Meta_AI-purple.svg)](https://github.com/facebookresearch/segment-anything)

[Demo](#-demo) • [Features](#-features) • [Installation](#-quick-start) • [Usage](#-usage) • [Documentation](#-documentation)

</div>

---

## 🌟 What is This?

**AI Wall Paint Visualizer** uses Meta's Segment Anything Model (SAM) to intelligently detect and paint walls in room photos. Upload a photo, and instantly preview different paint colors without any manual masking!

### ✨ Key Highlights

- 🤖 **AI-Powered Detection** - Automatically identifies wall surfaces
- ⚡ **Instant Color Changes** - Change colors in real-time after detection
- 🎯 **Smart Segmentation** - Distinguishes between main walls, accent walls, and objects
- 💻 **CPU/GPU Support** - Works on any system (GPU accelerated when available)
- 🎨 **20+ Color Presets** - Or choose any custom color
- 📊 **Confidence Scores** - See detection accuracy for each wall
- 🖼️ **No Manual Masking** - Zero manual work required

---

## 📸 Demo

<div align="center">

### Before Detection
<img src="docs/images/before.jpg" width="700" alt="Original room photo"/>

### After AI Detection & Painting
<img src="docs/images/after.jpg" width="700" alt="Painted room"/>

</div>

> 🎬 **Watch it in action:** [Demo Video](https://your-demo-link.com)

---

## 🚀 Features

### 🧠 Intelligent Wall Detection
- Powered by Meta's Segment Anything Model (SAM)
- Automatic wall classification (main walls, accent walls)
- Handles complex room layouts
- Filters out furniture and objects

### ⚡ Lightning-Fast Color Preview
- **Detect once, paint instantly** - No re-processing needed
- Real-time color changes with slider
- Adjustable opacity (10% - 100%)
- Multiple walls selection

### 💪 Performance Options
- **GPU Mode**: 5-10 seconds detection (when CUDA available)
- **CPU Mode**: 20-30 seconds detection (works everywhere)
- Automatic device detection
- Memory-efficient caching

### 🎨 Flexible Customization
- 20 pre-defined color palettes
- Custom color picker
- Individual wall selection
- Main walls only mode
- Before/after comparison view

---

## 🛠️ Tech Stack

### Backend
- **Python 3.8+** - Core language
- **PyTorch** - Deep learning framework
- **OpenCV** - Image processing
- **Flask** - REST API server
- **Segment Anything Model (SAM)** - AI segmentation

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ **Python 3.8+** ([Download](https://www.python.org/downloads/))
- ✅ **Node.js 14+** ([Download](https://nodejs.org/))
- ✅ **8GB+ RAM** (16GB recommended)
- ✅ **10GB free disk space**
- ⚡ **NVIDIA GPU** (optional, for faster processing)

---

## 🚀 Quick Start

### 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-wall-paint-visualizer.git
cd ai-wall-paint-visualizer
```

### 2️⃣ Download SAM Model (REQUIRED!)

The SAM model file is **2.5GB** and not included in the repository.

**Option A: Automatic Download (Recommended)**
```bash
cd backend
python download_model.py
```

**Option B: Manual Download**
1. Visit: [SAM Model Checkpoints](https://github.com/facebookresearch/segment-anything#model-checkpoints)
2. Download: `sam_vit_h_4b8939.pth` (2.5GB)
3. Place in: `backend/models/sam_vit_h_4b8939.pth`

### 3️⃣ Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4️⃣ Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install
```

### 5️⃣ Run Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

**Access:** Open http://localhost:3000 in your browser

---

## 📖 Usage

### Basic Workflow

1. **Upload Image** 📤
   - Click "Choose Room Image"
   - Select a photo of your room (JPG/PNG, max 16MB)

2. **Detect Walls** 🔍
   - Click "Detect Walls" button
   - Wait 20-30 seconds (CPU) or 5-10 seconds (GPU)
   - AI will identify all wall surfaces

3. **Choose Color** 🎨
   - Select from 20 color presets
   - Or use custom color picker
   - Adjust opacity slider (10-100%)

4. **Instant Preview** ⚡
   - Colors change in real-time
   - Select/deselect individual walls
   - Toggle "main walls only" mode

5. **Download Result** 💾
   - Click "Download Result"
   - Save your painted room image

### Pro Tips 💡

- **Best Results**: Use well-lit room photos with clear wall visibility
- **Faster Processing**: Use images under 1024px for CPU mode
- **Multiple Colors**: Deselect all, then select specific walls for different colors
- **Comparison View**: Toggle between stacked and side-by-side views

---

## 📁 Project Structure

```
ai-wall-paint-visualizer/
├── 📂 backend/
│   ├── app.py                          # Flask API server
│   ├── improved_sam_visualizer.py      # SAM integration
│   ├── download_model.py               # Model downloader
│   ├── requirements.txt                # Python dependencies
│   ├── .env.example                    # Environment template
│   ├── .gitignore
│   └── 📂 models/
│       └── sam_vit_h_4b8939.pth       # SAM model (download required)
│
├── 📂 frontend/
│   ├── 📂 src/
│   │   ├── WallPaintVisualizer.jsx    # Main React component
│   │   └── index.js                    # Entry point
│   ├── package.json                    # Node dependencies
│   ├── .gitignore
│   └── README.md
│
├── 📂 docs/
│   ├── SETUP.md                        # Detailed setup guide
│   ├── USAGE.md                        # Usage instructions
│   ├── TROUBLESHOOTING.md              # Common issues
│   └── API.md                          # API documentation
│
├── 📂 examples/
│   └── sample_room.jpg                 # Example image
│
├── README.md                           # This file
├── LICENSE                             # MIT License
└── .gitignore                          # Git ignore rules
```

---

## 🔧 Configuration

### Backend Configuration

Create `backend/.env` file:

```env
# Server Configuration
FLASK_ENV=development
SECRET_KEY=your-secret-key-here

# Model Configuration
SAM_CHECKPOINT=models/sam_vit_h_4b8939.pth
MODEL_TYPE=vit_h

# Processing Configuration
MAX_IMAGE_SIZE=1024
JPEG_QUALITY=95

# Device Configuration (auto-detected, can override)
# FORCE_CPU=false
```

### Frontend Configuration

Edit `frontend/src/WallPaintVisualizer.jsx`:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

---

## 📊 System Requirements

### Minimum Requirements
| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10/11, macOS 10.15+, Ubuntu 20.04+ |
| **Python** | 3.8 or higher |
| **Node.js** | 14 or higher |
| **RAM** | 8GB |
| **Storage** | 10GB free space |
| **Processor** | Multi-core CPU |

### Recommended (For GPU Acceleration)
| Component | Requirement |
|-----------|-------------|
| **GPU** | NVIDIA GPU with 8GB+ VRAM |
| **CUDA** | 11.7 or higher |
| **cuDNN** | Compatible version |
| **RAM** | 16GB |

---

## 🐛 Troubleshooting

### Common Issues

**❌ Model Not Found Error**
```
Solution: Download sam_vit_h_4b8939.pth to backend/models/
Run: python backend/download_model.py
```

**❌ CORS Error**
```
Solution: Ensure Flask server is running on port 5000
Check CORS settings in app.py
```

**❌ Out of Memory (CPU Mode)**
```
Solution: 
- Close other applications
- Use smaller images (< 1024px)
- Increase system RAM
```

**❌ Import Error: torch**
```
Solution:
- Activate virtual environment first
- Reinstall: pip install torch torchvision
```

**❌ Detection Takes Too Long**
```
CPU Mode: Normal (20-30 seconds)
Solution: Use GPU or smaller images
```

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more solutions.

---

## 📚 Documentation

- 📘 [Setup Guide](docs/SETUP.md) - Detailed installation steps
- 📙 [Usage Guide](docs/USAGE.md) - How to use the app
- 📕 [API Documentation](docs/API.md) - REST API endpoints
- 📗 [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues & fixes

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Meta AI** - For the amazing [Segment Anything Model](https://github.com/facebookresearch/segment-anything)
- **PyTorch Team** - For the deep learning framework
- **React Team** - For the frontend framework
- **OpenCV** - For image processing capabilities

---

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/YOUR_USERNAME/ai-wall-paint-visualizer/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/YOUR_USERNAME/ai-wall-paint-visualizer/discussions)
- 📧 **Email**: your.email@example.com

---

## 🌟 Star History

If you find this project helpful, please give it a ⭐!

[![Star History Chart](https://api.star-history.com/svg?repos=YOUR_USERNAME/ai-wall-paint-visualizer&type=Date)](https://star-history.com/#YOUR_USERNAME/ai-wall-paint-visualizer&Date)

---

## 📈 Roadmap

- [ ] Mobile app version (React Native)
- [ ] Multiple room support
- [ ] Color recommendations based on room type
- [ ] 3D room visualization
- [ ] Save/load color schemes
- [ ] Texture patterns support
- [ ] Cloud deployment
- [ ] API rate limiting
- [ ] User authentication

---

<div align="center">

**Made with ❤️ by [Your Name]**

[⬆ Back to Top](#-ai-wall-paint-visualizer)

</div>