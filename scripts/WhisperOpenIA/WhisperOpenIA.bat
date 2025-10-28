@echo off
setlocal EnableExtensions EnableDelayedExpansion
title 🎙️ Installation Whisper + Torch CPU + FFmpeg + Transcription SRT

echo ================================================================
echo        Assistant d'installation et de transcription Whisper
echo ================================================================
echo.

REM === Étape 1 : Installation Whisper et Torch CPU ==================
echo 🧩 Installation / mise à jour de Whisper et Torch (CPU)...
python -m pip install openai-whisper
python -m pip uninstall -y torch torchvision torchaudio
python -m pip cache purge
python -m pip install --upgrade --index-url https://download.pytorch.org/whl/cpu torch
python -m pip install --upgrade openai-whisper

echo.
echo ✅ Whisper et Torch (CPU) installés avec succès.
echo.

REM === Étape 2 : Installation de FFmpeg =============================
echo 🎞️ Vérification / installation de FFmpeg...
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo ⚠️ FFmpeg non détecté, tentative d'installation via Winget...
    winget install Gyan.FFmpeg
    if errorlevel 1 (
        echo ❌ Impossible d'installer FFmpeg automatiquement.
        echo Télécharge-le ici : https://www.gyan.dev/ffmpeg/builds/
        echo et ajoute le dossier /bin de FFmpeg dans le PATH.
        pause
        exit /b
    )
)
echo ✅ FFmpeg est installé.
echo.

REM === Étape 3 : Choix du modèle ====================================
echo ================================================================
echo 🔧 Choisis le modèle Whisper à utiliser :
echo    1. tiny   (le plus rapide, moins précis)
echo    2. base   (rapide, correct)
echo    3. small  (bon équilibre)
echo    4. medium (lent, très précis)
echo    5. large  (très lent, le plus précis)
echo ================================================================
set /p CHOIX="👉 Entrez un numéro (1-5) : "

if "%CHOIX%"=="1" set MODEL=tiny
if "%CHOIX%"=="2" set MODEL=base
if "%CHOIX%"=="3" set MODEL=small
if "%CHOIX%"=="4" set MODEL=medium
if "%CHOIX%"=="5" set MODEL=large
if "%MODEL%"=="" set MODEL=small

echo.
echo 📦 Modèle sélectionné : %MODEL%
echo.

REM === Étape 4 : Sélection du fichier audio =========================
echo Glisse ton fichier audio (.mp3, .m4a, .wav, etc.) ici puis appuie sur Entrée :
set /p AUDIO=

if not exist "%AUDIO%" (
    echo ❌ Fichier introuvable : "%AUDIO%"
    echo Vérifie le chemin et réessaie.
    pause
    exit /b
)

REM === Étape 5 : Transcription ======================================
echo.
echo 🚀 Transcription en cours avec le modèle %MODEL% (langue: Français)...
whisper "%AUDIO%" --model %MODEL% --language French --output_format srt

if errorlevel 1 (
    echo ❌ Erreur pendant la transcription.
    echo Vérifie que FFmpeg est bien installé et que le fichier audio est valide.
    pause
    exit /b
)

echo.
echo ✅ Transcription terminée ! Le fichier .srt se trouve à côté de ton audio.
echo.
pause
