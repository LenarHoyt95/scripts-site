@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Installation Whisper + Torch CPU + FFmpeg + Transcription SRT

echo ===========================================================================
echo     Assistant d'installation et de transcription Whisper (ByLenarHoyt95)
echo ===========================================================================
echo.

REM === Etape 1 : Installation Whisper et Torch CPU ==================
echo Installation / mise a jour de Whisper et Torch (CPU)...
python -m pip install openai-whisper
echo.
echo Suppression des anciennes versions de Torch...
python -m pip uninstall -y torch torchvision torchaudio
python -m pip cache purge
echo.
echo Installation de Torch (version CPU uniquement)...
python -m pip install --upgrade --index-url https://download.pytorch.org/whl/cpu torch
echo.
echo Mise a jour finale de Whisper...
python -m pip install --upgrade openai-whisper
echo.
echo Whisper et Torch (CPU) installes avec succes.
echo ---------------------------------------------------------------
echo.
timeout /t 10

REM === Etape 2 : Installation de FFmpeg =============================
echo Verification / installation de FFmpeg...
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo FFmpeg non detecte, tentative d'installation via Winget...
    winget install Gyan.FFmpeg
    if errorlevel 1 (
        echo Impossible d'installer FFmpeg automatiquement.
        echo Telecharge-le ici : https://www.gyan.dev/ffmpeg/builds/
        echo et ajoute le dossier /bin de FFmpeg dans le PATH.
        pause
        exit /b
    )
)
echo.
echo FFmpeg est installe ou deja present.
echo ---------------------------------------------------------------
echo.
timeout /t 10

REM === Etape 3 : Choix du modele ====================================
echo ===============================================================
echo Choisis le modele Whisper a utiliser :
echo   1. tiny   (le plus rapide, moins precis)
echo   2. base   (rapide, correct)
echo   3. small  (bon equilibre)
echo   4. medium (lent, tres precis)
echo   5. large  (tres lent, le plus precis)
echo ===============================================================
set /p CHOIX="Entrez un numero (1-5) : "

if "%CHOIX%"=="1" set MODEL=tiny
if "%CHOIX%"=="2" set MODEL=base
if "%CHOIX%"=="3" set MODEL=small
if "%CHOIX%"=="4" set MODEL=medium
if "%CHOIX%"=="5" set MODEL=large
if "%MODEL%"=="" set MODEL=small

echo.
echo Modele selectionne : %MODEL%
echo ---------------------------------------------------------------
echo.
timeout /t 10

REM === Etape 4 : Selection du fichier audio ========================
echo Glisse ton fichier audio (.mp3, .m4a, .wav, etc.) ici puis appuie sur Entree :
set /p AUDIO=

if not exist "%AUDIO%" (
    echo Fichier introuvable : "%AUDIO%"
    echo Verifie le chemin et reessaye.
    pause
    exit /b
)

REM === Etape 5 : Transcription =====================================
echo.
echo Transcription en cours avec le modele %MODEL% (langue: Francais)...
echo ---------------------------------------------------------------
whisper "%AUDIO%" --model %MODEL% --language French --output_format srt

if errorlevel 1 (
    echo Erreur pendant la transcription.
    echo Verifie que FFmpeg est bien installe et que le fichier audio est valide.
    pause
    exit /b
)

echo.
echo Transcription terminee ! Le fichier .srt se trouve a cote de ton audio.
echo ---------------------------------------------------------------
echo.
pause