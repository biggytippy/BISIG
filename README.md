# BISIG - Bidirectional Interface for Sign Intelligence & Gestures

[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Datasets-yellow)](https://huggingface.co/datasets/Golgrax/bisig-fsl-dataset)

BISIG (FSL Intelligence) is a unified platform designed to empower the Filipino deaf and hard-of-hearing community by bridging the communication gap through real-time, bidirectional translation between Filipino Sign Language (FSL) and spoken/written language.

## 🚀 Ecosystem Overview

The project consists of three core components working together to provide a seamless translation experience:

### 1. **Backend API** (`/Backend-API`)
A high-performance REST API designed to translate text into sign language video sequences and high-fidelity skeleton datasets.
- **Multi-Language Support**: ASL and full native support for Filipino Sign Language (FSL).
- **Human Reference Preview**: Side-by-side human reference video previews for all signs.
- **Smart Variant Selection**: Automatically detects and selects between linguistic variants.
- **High-Fidelity Tracking**: Tracks 478 face landmarks and 33 pose landmarks for accurate avatar rendering.

### 2. **Frontend** (`/Frontend`)
A modern web-native interface that connects to the backend API to provide a user-friendly translation experience.
- **Real-time Interface**: Accessible via any modern browser.
- **Pose Estimation**: Uses TensorFlow.js and MediaPipe for on-device pose detection.
- **Visual Feedback**: Renders translations via 3D Avatars (Three.js), skeletal data, or photorealistic videos.

### 3. **FSL Datasets & Unified Server** (`/FSL-Datasets`)
The core data repository and high-performance media server.
- **Unified Architecture**: A Go-based server that handles media delivery and intelligent proxying for the entire ecosystem.
- **Large Dataset**: Managing over 9,900+ FSL video files.
- **Authentication**: A complete auth system (Node.js/SQLite) for progress tracking and user management.

## 🛠️ Project Structure

- `Backend-API/`: Core translation engine (Python/FastAPI/MediaPipe).
- `Frontend/`: React-based user interface.
- `FSL-Datasets/`: Go-based media server, dataset metadata, and authentication backend.

## 📡 Key Features

- **Bidirectional Translation**: Supports both Sign-to-Text and Text-to-Sign.
- **Localized for FSL**: Specifically trained and optimized for Filipino Sign Language.
- **Hybrid Search**: Intelligent fallback mechanisms between languages and fingerspelling.
- **High-Resolution Data**: Provides raw landmark coordinates for interactive 3D applications.

## 🚀 Getting Started

To run the entire ecosystem locally, you can use the startup script:

1. **Start all services with a Colab Tunnel URL**:
   Provide your LMM visual server's tunnel URL (e.g., LocalTunnel) via the `COLAB_URL` environment variable:
   ```bash
   chmod +x start_all.sh
   COLAB_URL="https://your-tunnel-subdomain.loca.lt" ./start_all.sh
   ```

Or you can refer to the specific setup guides within each directory for individual components:
- [Backend Setup](./Backend-API/README.md)
- [Frontend Setup](./Frontend/README.md)
- [Dataset & Server Setup](./FSL-Datasets/README.md)

## 🙏 Credits & Data Sources

We would like to express our gratitude to the following organizations for making this project possible:

- **FSL Datasets**: Special thanks to the **Iglesia ni Cristo** for providing the comprehensive Filipino Sign Language datasets used in this project.
- **ASL Datasets**: We credit the **Pocket Sign ASL App** ([pocketsign.org](https://www.pocketsign.org/)) for the American Sign Language video resources.

## ⚖️ License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.
