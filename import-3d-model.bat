@echo off
echo ========================================
echo   Importador de Modelos 3D para TMHub
echo ========================================
echo.

set /p model_name="Nome do modelo (ex: timo_cyber): "
set /p source_path="Caminho do arquivo .glb ou .blend (ex: C:\Users\Guilherme\Documents\timo_voice_recognizer\assets\3d\cyber_timo.blend): "

echo.
echo Importando %model_name%...

REM Convert .blend to .glb if needed using Blender (if available)
if "%source_path:~-5%"==".blend" (
    echo Convertendo .blend para .glb...
    if exist "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" (
        set "blender_path=C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
    ) else (
        echo ERROR: Blender não encontrado!
        echo Por favor, exporte o arquivo .glb manualmente e tente novamente.
        pause
        exit /b 1
    )
    
    set "export_script=%TEMP%\export_%model_name%.py"
    echo import bpy > "%export_script%"
    echo bpy.ops.wm.open_mainfile(filepath=r"%source_path%") >> "%export_script%"
    echo bpy.ops.export_scene.gltf(filepath=r"C:\Users\Guilherme\Documents\tmhub\public\3d-models\%model_name%.glb", export_format='GLB') >> "%export_script%"
    
    "%blender_path%" --background --python "%export_script%"
    del "%export_script%"
) else (
    echo Copiando arquivo...
)

copy /Y "%source_path%" "C:\Users\Guilherme\Documents\tmhub\public\3d-models\%model_name%.glb"

echo.
echo ========================================
echo   Importação concluída!
echo ========================================
echo.
echo O arquivo foi salvo em:
echo   C:\Users\Guilherme\Documents\tmhub\public\3d-models\%model_name%.glb
echo.
echo Agora você pode commitar e fazer deploy!
echo.

pause
