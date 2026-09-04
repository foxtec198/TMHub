@echo off
echo ========================================
echo   Exportador de Cenários para TMHub
echo ========================================
echo.

set "blender_path=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
set "export_script=%TEMP%\export_scene.py"
set "output_dir=C:\Users\Guilherme\Documents\tmhub\public\scenes"

if not exist "%blender_path%" (
    echo ERRO: Blender não encontrado!
    echo Instale o Blender 4.2 em https://www.blender.org/download/
    pause
    exit /b 1
)

echo Usando Blender: %blender_path%
echo.

:: Get scene name from user
set /p scene_name="Nome do cenário (ex: cyberpunk): "

echo.
echo Criando script de exportação para %scene_name%...

:: Create export script
echo import bpy > "%export_script%"
echo. >> "%export_script%"
echo " import bmesh " >> "%export_script%"
echo " from pathlib import Path " >> "%export_script%"
echo. >> "%export_script%"
echo " OUTPUT = Path(r'C:\Users\Guilherme\Documents\tmhub\public\scenes') " >> "%export_script%"
echo " OUTPUT.mkdir(parents=True, exist_ok=True) " >> "%export_script%"
echo " SCENE_OUTPUT = OUTPUT / '%scene_name%.webp' " >> "%export_script%"
echo. >> "%export_script%"
echo " scene = bpy.context.scene " >> "%export_script%"
echo " scene.render.engine = 'BLENDER_EEVEE' " >> "%export_script%"
echo " scene.render.resolution_x = 768 " >> "%export_script%"
echo " scene.render.resolution_y = 768 " >> "%export_script%"
echo " scene.render.image_settings.file_format = 'PNG' " >> "%export_script%"
echo " scene.render.film_transparent = True " >> "%export_script%"
echo. >> "%export_script%"
echo " # Set camera " >> "%export_script%"
echo " cam = scene.camera " >> "%export_script%"
echo " if not cam: " >> "%export_script%"
echo "     cam_data = bpy.data.cameras.new('Camera') " >> "%export_script%"
echo "     cam = bpy.data.objects.new('Camera', cam_data) " >> "%export_script%"
echo "     scene.collection.objects.link(cam) " >> "%export_script%"
echo "     scene.camera = cam " >> "%export_script%"
echo "     cam.location = (0, -4, 1.5) " >> "%export_script%"
echo "     cam.rotation_euler = (1.5708, 0, 0) " >> "%export_script%"
echo. >> "%export_script%"
echo " scene.frame_set(1) " >> "%export_script%"
echo " scene.render.filepath = str(SCENE_OUTPUT) " >> "%export_script%"
echo " bpy.ops.render.render(write_still=True) " >> "%export_script%"
echo. >> "%export_script%"
echo " print(f'✅ Cenário exportado: %s' % SCENE_OUTPUT) " >> "%export_script%"

echo Executando exportação...
"%blender_path%" --background --python "%export_script%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Exportação concluída!
    echo ========================================
    echo.
    echo Cenário salvo em:
    echo   %output_dir%\%scene_name%.webp
    echo.
    echo Agora você pode:
    echo   1. Adicionar ao frontend (TimoAssistant/index.jsx)
    echo   2. Commitar as mudanças
    echo   3. Fazer deploy
    echo.
) else (
    echo.
    echo ERRO na exportação!
    echo Verifique os logs acima.
    echo.
)

pause
