@echo off
echo ========================================
echo   Exportador de Cenário Cyberpunk
echo ========================================
echo.

echo Iniciando exportação do cenário Cyberpunk...
echo.

set "blender_path=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
set "export_script=%TEMP%\export_cyberpunk_scene.py"
set "output_dir=C:\Users\Guilherme\Documents\tmhub\public\3d-models"

if not exist "%blender_path%" (
    echo ERRO: Blender não encontrado!
    echo Instale o Blender 4.2 em https://www.blender.org/download/
    pause
    exit /b 1
)

echo Usando Blender: %blender_path%
echo.

REM Copy the export script to temp
copy /Y "%~dp0export_cyberpunk_scene.py" "%export_script%"

echo Exportando cenário Cyberpunk...
"%blender_path%" --background --python "%export_script%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Exportação concluída!
    echo ========================================
    echo.
    echo Cenário salvo em:
    echo   %output_dir%\cyberpunk_scene.glb
    echo.
    echo Agora você pode:
    echo   1. Commitar as mudanças
    echo   2. Fazer deploy
    echo.
) else (
    echo.
    echo ERRO na exportação!
    echo Verifique os logs acima.
    echo.
)

pause
