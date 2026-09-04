@echo off
echo ========================================
echo   Exportador de Cyber Timo Fixado
echo ========================================
echo.

set "blender_path=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
set "export_script=%TEMP%\export_cyber_timo.py"

if not exist "%blender_path%" (
    echo ERRO: Blender não encontrado!
    echo Instale o Blender 4.2 em https://www.blender.org/download/
    pause
    exit /b 1
)

echo Usando Blender: %blender_path%
echo.

:: Copy export script to temp
copy /Y "%~dp0export_cyber_timo_fixed.py" "%export_script%"

echo Exportando Cyber Timo (com correção do ArmR e texturas)...
echo.

"%blender_path%" --background --python "%export_script%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Exportação concluída!
    echo ========================================
    echo.
    echo Arquivos salvos em:
    echo   C:\Users\Guilherme\Documents\tmhub\public\cyber_timo.glb
    echo   C:\Users\Guilherme\Documents\tmhub\public\cyber_timo-poster.png
    echo.
    echo Agora você pode:
    echo   1. Verificar os arquivos
    echo   2. Commitar as mudanças
    echo   3. Fazer deploy
    echo.
) else (
    echo.
    echo ERRO na exportação!
    echo Verifique os logs acima.
    echo.
    echo Possíveis causas:
    echo   - O arquivo cyber_timo.blend não existe
    echo   - O armature "TimoRig" não foi encontrado
    echo   - A animação "idle" não existe
    echo.
)

pause
