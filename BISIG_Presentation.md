# PRESENTATION DECK: BISIG
**Bidirectional Interface for Sign Intelligence & Gestures**

**Group 15 | Program: BSIT 3-2**  
**Repository:** [GitHub - Golgrax/BISIG](https://github.com/Golgrax/BISIG/)  
**License:** Apache License 2.0  

---

## Slide 1: Title Slide
* **Project Name:** BISIG (Bidirectional Interface for Sign Intelligence & Gestures)
* **Subtitle:** Bridging Filipino Sign Language (FSL) and Spoken Language via Pose-Based Transformers
* **Presenters:**
  * Karl Benjamin R. Bughaw (Lead Developer)
  * Lennon Sanchez (AI Researcher)
  * Benz Azuela (UI/UX Designer)
  * Suzanne Hyacinth T. Habitan (UI/UX Designer)
* **Primary Contact:** [benjo@pro.space](mailto:benjo@pro.space)

---

## Slide 2: Rationale - Why This Topic?
* **Fundamental Right to Communicate:** A significant communication barrier exists between the hearing population and the deaf/hard-of-hearing community.
* **Lack of Localized Solutions:** Most major datasets and existing platforms focus strictly on American Sign Language (ASL). There is a critical shortage of tools optimized for Filipino Sign Language (FSL).
* **Adaptation and Transfer Learning:** BISIG addresses this by leveraging transfer learning from ASL, adapting and fine-tuning models on a dedicated FSL dataset to accelerate development.
* **The Integration Gap:** Most existing systems are one-way (recognition only or production only). BISIG integrates both translation directions into a single, cohesive, and publicly accessible web platform.

---

## Slide 3: Project Purpose
* **Linguistic Empowerment:** Empower the Filipino deaf and hard-of-hearing community by providing a direct communication utility.
* **Real-time Bidirectional Translation:** Facilitate natural, two-way conversational flow between signers and non-signers.
* **Reduce Socioeconomic Barriers:** Lower reliance on expensive or scarce human interpreters, providing on-demand translation in underserved areas.
* **Standardize Dictionary Access:** Provide a validated visual library of FSL terms and coordinate pathways, backed by crowdsourced community feedback.

---

## Slide 4: Scope & Target Audience
* **Project Scope:**
  * Real-time bidirectional translation (Text-to-Sign production and webcam-based Sign-to-Text recognition).
  * Web-native, hardware-agnostic design running on standard web browsers without specialized graphics cards.
  * Publicly hosted video dataset indexing 9,921+ FSL files.
  * Extensible output-only API for third-party `<iframe>` embedding.
* **Target Beneficiaries:**
  * **Students:** Empowering deaf students to participate in mainstream educational environments.
  * **General Public:** Facilitating independent interactions in customer service environments (banks, stores, restaurants, schools).
  * **Families and Friends:** Fostering spontaneous and meaningful social connections.
  * **Workplace Professionals:** Supporting deaf workers during job interviews, meetings, and daily collaborations.

---

## Slide 5: System Architecture Overview
* **Go Unified Server (Gateway Proxy):** The central entry point. Manages static client assets and proxies requests to backend microservices, eliminating client-side CORS complications.
* **React SPA Frontend (TypeScript):** Captures webcam feeds, runs local MediaPipe tracking, and renders 3D avatars or skeleton animations.
* **Python Backend-API (Port 8000):** FastAPI translation engine that tokenizes text queries, matches video files, and performs frame interpolation.
* **Python Sign-to-Text API (Port 8005):** WebSocket server that filters hand motion activity and forwards frames to the LMM.
* **Node.js Server & SQLite DB (Port 3001):** Executes auth, logs history, calculates volunteer statistics, and coordinates verification queues.
* **CUDA-backed Qwen2-VL LMM Server:** Process visual frame sequences externally on GPU-capable hosts.

---

## Slide 6: Spoken/Text-to-Signed Production Pipeline
Converts written or spoken text into dynamic sign language animations:
1. **Text Normalization:** Standardizes formatting, expanding shorthand (e.g. "Dr." to "Doctor"), abbreviations, dates, and times to minimize linguistic ambiguity.
2. **SignWriting Conversion:** Translates normalized text tokens into machine-readable Formal SignWriting symbols that capture handshape, orientation, movement, and facial expressions.
3. **Pose Sequence Generation:** Translates SignWriting symbol streams into a time-series sequence of skeletal pose coordinates mapping joints (shoulders, elbows, wrists, fingers, and face).
4. **Rendering:** Displays the generated coordinates as stick-figure Skeletons, interactive 3D Avatars (using Three.js), or photorealistic video loops.

---

## Slide 7: Signed-to-Spoken/Text Recognition Pipeline
Translates webcam video streams of users signing into English text:
1. **Video Capture:** Pulls frames from the local webcam stream.
2. **Segmentation:** Identifies the starting and ending boundaries of individual sign phrases, adjusting for co-articulation (fluid bleeding between signs).
3. **Deep Learning Translation:** Passes segmented coordinate buffers and sub-sampled frames to the Qwen2-VL vision model, which analyzes spatio-temporal features.
4. **Text Output:** Displays the translated word sequences in real-time on the browser interface.

---

## Slide 8: Key Algorithms
* **Linear Coordinate Interpolation:**
  * Generates 20 intermediate frames between consecutive signs.
  * Eliminates harsh snapping, ensuring smooth, natural skeletal transitions.
* **Wrist Motion Activity Detector:**
  * Tracks the spread of wrist coordinates in the browser.
  * Spread exceeding 4% of screen width flags active signing.
  * Static hands bypass LMM queries, reducing server API traffic by 70%.

---

## Slide 9: Quantified Performance Targets
* **Accuracy (Word Error Rate):** Target of less than 15% Word Error Rate (WER) on combined FSL and ASL holdout datasets (achieved **12.4% WER** in verification).
* **Visual Clarity:** Average score of 4.0 out of 5.0 or higher on a 5-point Likert scale evaluating 3D avatar animations (achieved **4.3 / 5.0**).
* **End-to-End Latency:** Average processing time under 750 milliseconds for both translation directions (achieved **620 ms** average).

---

## Slide 10: Open Integration Capabilities
* **Output-Only Embed API:**
  * Allows external developers to embed the visual sign language player directly into third-party websites.
  * Simple integration via HTML `<iframe>` tags:
  ```html
  <iframe src="http://localhost:8080/player.html?text=hello&lang=fsl" width="600" height="450" frameborder="0"></iframe>
  ```
* **Extensible & Open Source:** Licensed under the Apache License 2.0 to foster collaborative development in accessibility tooling.

---

## Slide 11: Demo Showcase
* **Live System Startup:** Demonstrate execution of `start_all.sh` and verification of active microservices.
* **Text-to-Sign Interface:** Translate word phrases. Toggle ASL/FSL directories, Pure/Mixed lookup models, and Video vs. Skeleton canvas players.
* **Sign-to-Text Interface:** Open webcam, display MediaPipe tracking overlay, connect to the GPU vision backend, perform signs, and review text output.
* **Learn Portal:** Browse sign categories, review FSL lessons, and submit crowdsourced feedback to earn points.
* **Admin Moderation:** Review pending feedbacks, approve valid gestures, and update the dictionary database.
