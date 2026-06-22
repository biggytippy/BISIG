# USER MANUAL: BISIG
**Bidirectional Interface for Sign Intelligence & Gestures**

**Document Version:** 2.2.0  
**Published:** June 22, 2026  
**Open Source Repository:** [GitHub - Golgrax/BISIG](https://github.com/Golgrax/BISIG/)  
**License:** Apache License 2.0  

---

## Meet the Team
**Group 15 | Program: BSIT 3-2**

- **Karl Benjamin R. Bughaw** (Lead Developer, Project Founder & Full-Stack Engineer)  
  *Email:* [benjo@pro.space](mailto:benjo@pro.space)  
- **Lennon Sanchez** (AI Researcher)  
- **Benz Azuela** (UI/UX Designer)  
- **Suzanne Hyacinth T. Habitan** (UI/UX Designer)  

---

## Table of Contents
1. [Introduction](#1-introduction)
   - [1.1 Purpose of the System](#11-purpose-of-the-system)
   - [1.2 Key Features and Functionality](#12-key-features-and-functionality)
   - [1.3 Target Beneficiaries](#13-target-beneficiaries)
2. [Setup & System Requirements](#2-setup--system-requirements)
   - [2.1 Device Specifications](#21-device-specifications)
   - [2.2 Quick Installation Guide](#22-quick-installation-guide)
   - [2.3 Troubleshooting Setup Errors](#23-troubleshooting-setup-errors)
3. [Getting Started](#3-getting-started)
   - [3.1 Setting Up an Account](#31-setting-up-an-account)
   - [3.2 User Roles Explained](#32-user-roles-explained)
   - [3.3 Interface Navigation](#33-interface-navigation)
4. [Step-by-Step Operations](#4-step-by-step-operations)
   - [4.1 Running Text-to-Sign Translations](#41-running-text-to-sign-translations)
   - [4.2 Running Sign-to-Text Recognition](#42-running-sign-to-text-recognition)
   - [4.3 Browsing the Sign Dictionary](#43-browsing-the-sign-dictionary)
   - [4.4 Crowdsourcing Sign Verifications](#44-crowdsourcing-sign-verifications)
   - [4.5 Embedding the Translation Player (iframe Integration)](#45-embedding-the-translation-player-iframe-integration)
   - [4.6 Viewing Your Translation History](#46-viewing-your-translation-history)
   - [4.7 Admin Controls (Moderation Panel)](#47-admin-controls-moderation-panel)
5. [Safety, Privacy, & Data Protection](#5-safety-privacy--data-protection)
   - [5.1 Camera Stream Privacy](#51-camera-stream-privacy)
   - [5.2 Local Database Safety](#52-local-database-safety)
6. [Advanced Technical Features](#6-advanced-technical-features)
   - [6.1 Real-time Skeleton Interpolation](#61-real-time-skeleton-interpolation)
   - [6.2 Deep Learning Vision Matcher](#62-deep-learning-vision-matcher)
7. [Frequently Asked Questions (FAQ)](#7-frequently-asked-questions-faq)
8. [Support & Contact Details](#8-support--contact-details)

---

## 1. Introduction

### 1.1 Purpose of the System
The **Bidirectional Interface for Sign Intelligence & Gestures (BISIG)** is a web-native application designed to bridge the communication gap between the hearing population and the Filipino deaf and hard-of-hearing community. 

BISIG serves as an interactive translation and learning bridge, supporting translations between written English text and Filipino Sign Language (FSL) or American Sign Language (ASL).

---

### 1.2 Key Features and Functionality
- **Text-to-Sign Engine:** Converts typed text into individual video clips or real-time skeletal coordinate representations.
- **Sign-to-Text Vision Matcher:** Utilizes webcams to capture user gestures, processes the coordinates locally, and uses advanced Large Multimodal Models (LMM) to translate signs back into text.
- **Volunteer Crowdsourcing:** Allows users to earn points and ranking levels by validating recorded gestures to help expand the official FSL dictionary.
- **FSL Dictionary:** Serves as a library of terms categorised for easy learning.

---

### 1.3 Target Beneficiaries
- **Deaf and Hard-of-Hearing Students:** Empowers students to engage and participate more effectively in mainstream educational classrooms.
- **The General Public:** Facilitates independent communication in customer service environments (e.g. banks, restaurants, stores, and schools).
- **Families and Friends:** Fosters spontaneous, natural, and meaningful social connections between signers and non-signers.
- **Workplace Professionals:** Assists individuals in professional environments during job interviews, meetings, and daily collaborative sessions.

---

## 2. Setup & System Requirements

### 2.1 Device Specifications
To ensure smooth webcam parsing and layout transitions, verify your workstation aligns with these parameters:
- **Operating System:** Windows 10/11 (with WSL), Ubuntu Linux 20.04+, or macOS.
- **Browser:** Google Chrome, Microsoft Edge, or Apple Safari (updated to the latest release).
- **Camera Device:** Integrated HD camera or external USB webcam (720p at 30 FPS minimum).
- **RAM Capacity:** 8 GB minimum (16 GB recommended).
- **Disk Storage:** At least 10 GB free space (to download the video libraries).
- **Network Interface:** Active broadband connection (minimum 10 Mbps).

---

### 2.2 Quick Installation Guide
1. Open your terminal window and type:
   ```bash
   git clone https://github.com/Golgrax/BISIG.git
   cd BISIG
   chmod +x start_all.sh
   ./start_all.sh
   ```
2. The installation scripts check for required libraries (`libgles2`, `libgl1`, etc.) and launch the server components.
3. Access the dashboard by opening your browser and entering:
   `http://localhost:5173`

---

### 2.3 Troubleshooting Setup Errors

#### Camera Permission Blocked
- **Symptom:** Browser console prints a warning: `Initial camera check failed`, or a blank screen is displayed instead of the webcam feed.
- **Remedy:** Click the camera icon in your browser's address bar and select **Allow access**. Ensure your webcam is not in use by other software.

#### Tunnel Connection Errors
- **Symptom:** Sign recognition shows the status **Vision Server Offline**.
- **Remedy:** Ensure the external Qwen2-VL LMM server is running on Colab. Copy the generated LocalTunnel URL and paste it into the **Settings panel** of the Sign-to-Text window.

---

## 3. Getting Started

### 3.1 Setting Up an Account

You can use basic translation functions as a guest. However, saving your history, validating signs, and climbing the ranking ladder requires an account.

```
       +---------------------------------------------+
       |                  LOGIN MODAL                |
       +---------------------------------------------+
       |  Username: [ volunteer_joe ]                |
       |  Password: [ ************* ]                |
       |                                             |
       |       [ SUBMIT ]        [ Go to Sign Up ]   |
       +---------------------------------------------+
```

1. Click **Login** on the top right section of the menu bar.
2. In the modal, click **Go to Sign Up**.
3. Choose a unique **Username** and secure **Password**.
4. Click **Sign Up** to create your profile.
5. Log in with your new credentials.

---

### 3.2 User Roles Explained
- **Volunteer (User):** Accesses translation views, reviews dictionaries, validates gestures, and earns points to unlock higher ranks.
- **Administrator:** Full privileges. Includes access to the Moderation Panel to approve or reject crowdsourced volunteer validations.

---

### 3.3 Interface Navigation

```
+--------------------------------------------------------------------------------+
|  BISIG LOGO   [Home]  [Translator]  [Learn/Dictionary]  [Directory]  [About]   |
+--------------------------------------------------------------------------------+
```

- **Home:** Displays metrics, system statuses, and quick action shortcuts.
- **Translator:** Houses the Text-to-Sign translation player and the webcam Sign-to-Text matcher.
- **Learn:** Houses the dictionary categories and verification task lists.
- **Directory:** Search tools for local sign interpreters and deaf-friendly establishments.
- **About:** Displays information about the development team, sponsors, and academic references.

---

## 4. Step-by-Step Operations

### 4.1 Running Text-to-Sign Translations

```
  Step 1: Input text phrase   ----to--->   Step 2: Hit "Translate"   ----to--->   Step 3: Play Sign Replay
  [ "hello friend" ]                       [ TRANSLATE BUTTON ]                   [ Combined Avatar Video ]
```

1. Open the **Translator** page and select the **Text-to-Sign** tab.
2. Select your **Target Language** (FSL or ASL).
3. Select your **Mode** parameter:
   - **Mixed:** Automatically uses fallback dictionary words from ASL if the FSL word is missing.
   - **Pure:** Strictly queries within the target language.
4. Input your sentence in the text box (e.g., `"hello friend"`).
5. Click the green **Translate** button.
6. The system will retrieve the assets and play the sign language clip. You can toggle the **Skeleton** switch to display the real-time interpolated skeleton avatar.

---

### 4.2 Running Sign-to-Text Recognition

1. Select the **Sign-to-Text** tab.
2. The browser will request camera permission. Select **Allow**.
3. Input the active **Vision Server URL** in the settings field.
4. Set the **Recognition Threshold** (recommended setting is around `0.3`). A lower value is more lenient, while a higher value is more strict.
5. Stand in front of the camera and click **Start Capturing**.
6. The window will display your video feed overlaid with MediaPipe tracking dots.
7. Perform your gesture clearly. Once the system detects hand movement, it will process the frames and query the LMM.
8. The predicted words will appear in the transcription log.
9. Click **Stop Capturing** to finish.

---

### 4.3 Browsing the Sign Dictionary
1. Navigate to the **Learn** page.
2. Select a category (e.g., *Common Greetings*, *Nouns*, *Numbers*) or search for a word in the dictionary search field.
3. Select any sign from the list.
4. Click the **Play** button to view the official FSL training video, or switch to the **Skeleton** view to review coordinate paths.

---

### 4.4 Crowdsourcing Sign Verifications
1. Navigate to the **Learn** page.
2. Select a word from the FSL dictionary.
3. View the user-submitted video or skeleton coordinates.
4. Answer the verification prompt: "Is this gesture represented correctly?"
5. Click **Thumbs Up** (Yes) or **Thumbs Down** (No), write optional feedback (e.g., "Hand shape is slightly off"), and click **Submit Verification**.
6. You will earn points (+50 points) and progress to higher volunteer levels.

---

### 4.5 Embedding the Translation Player (iframe Integration)
You can embed the BISIG Text-to-Sign translation components directly into your own third-party website using standard `<iframe>` options:
1. Identify the URL of your unified BISIG server deployment (e.g., `http://localhost:8080`).
2. Implement the following HTML code in your website layout:
   ```html
   <iframe 
     src="http://localhost:8080/player.html?text=hello&lang=fsl" 
     width="600" 
     height="450" 
     frameborder="0">
   </iframe>
   ```

---

### 4.6 Viewing Your Translation History
1. Log in to your volunteer account.
2. Your translated history items will show up inside the **History panel** of the translator view.
3. Click on any past item to instantly replay it in the translation player.

---

### 4.7 Admin Controls (Moderation Panel)
1. Log in to an account with administrator rights.
2. Navigate to the **Moderation Panel** under your user profile menu.
3. Review the pending list of crowdsourced feedbacks submitted by volunteers.
4. For accurate gestures, click **Approve**. The gesture will be added to the dictionary database.
5. For incorrect gestures, click **Reject** to remove the entry from the verification queue.

---

## 5. Safety, Privacy, & Data Protection

### 5.1 Camera Stream Privacy
The webcam stream processed by the MediaPipe landmark estimator is run **locally inside your browser context**. No raw video feeds are sent to external databases or stored on remote servers. Only sub-sampled frame coordinates are sent to the vision endpoint when translation is active.

### 5.2 Local Database Safety
Login information, session data, and translation histories are kept in a local SQLite file (`db.sqlite`) protected with Bcrypt hashing. Ensure database backups are kept secure.

---

## 6. Advanced Technical Features

### 6.1 Real-time Skeleton Interpolation
To prevent visual lag and teleportation effects, the player applies linear interpolation across 20 intermediate frames between consecutive signs. This results in natural, continuous movement for the avatar.

### 6.2 Deep Learning Vision Matcher
The Sign-to-Text engine uses a GPU-backed **Qwen2-VL Multimodal Vision-Language Model**. By analyzing sequential base64 image streams, it recognizes the dynamic morphology of gestures and returns translated text, bypassing environmental noise.

---

## 7. Frequently Asked Questions (FAQ)

**Q: Why does the system fall back to spelling out letters?**
A: If a specific word is not present in the FSL or ASL dictionary, the engine defaults to fingerspelling it letter-by-letter.

**Q: Can I use the application without internet connectivity?**
A: Text-to-Sign translation, local dictionary lookups, and account logins can run completely offline. However, webcam-based Sign-to-Text translation requires an active connection to the Qwen2-VL server.

**Q: How does the fingerspelling system work?**
A: The system automatically matches missing vocabulary terms to their individual constituent letters, retrieving and smoothly concatenating individual hand shapes representing the alphabet (A-Z) from the ASL or FSL dataset library.

**Q: Can I suggest new sign translations?**
A: Yes! By submitting crowdsourced verification feedback under the learn tab, you help flag vocabulary adjustments, which are then reviewed and finalized by system moderators.

---

## 8. Support & Contact Details
For bug reports, technical support, or updates:
- **Lead Developer Support:** Karl Benjamin (benjo@pro.space)
