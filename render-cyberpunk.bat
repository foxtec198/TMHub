@echo off
echo ========================================
echo   Renderizador de Cenário Cyberpunk
echo ========================================
echo.

set "blender_path=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
set "render_script=%TEMP%\render_cyberpunk.py"

if not exist "%blender_path%" (
    echo ERRO: Blender não encontrado!
    echo Instale o Blender 4.2 em https://www.blender.org/download/
    echo.
    pause
    exit /b 1
)

echo Usando Blender: %blender_path%
echo.

:: Copy render script to temp
copy /Y "%~dp0render_cyberpunk_scene.py" "%render_script%"

echo Renderizando cenário Cyberpunk...
echo (Isso pode levar alguns segundos...)
echo.

"%blender_path%" --background --python "%render_script%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Renderização concluída!
    echo ========================================
    echo.
    echo Arquivo salvo em:
    echo   C:\Users\Guilherme\Documents\tmhub\public\scenes\cyberpunk.webp
    echo.
    echo Agora você pode:
    echo   1. Verificar a imagem
    echo   2. Commitar as mudanças
    echo   3. Fazer deploy
    echo.
) else (
    echo.
    echo ERRO na renderização!
    echo Verifique se o Blender está instalado corretamente.
    echo.
)

pause
