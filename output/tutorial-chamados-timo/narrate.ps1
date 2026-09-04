$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$studioPath=$PSScriptRoot
$audioPath=Join-Path $studioPath 'audio'
New-Item -ItemType Directory -Force -Path $audioPath | Out-Null
$scriptText=Get-Content (Join-Path $studioPath '../../docs/tutorials/abertura-chamados/teleprompter.txt') -Raw -Encoding UTF8
$paragraphs=@(($scriptText.Trim() -split '\r?\n\s*\r?\n') | Select-Object -Skip 1)
$speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Daniel')
$speaker.Rate=-1
$speaker.Volume=100
$manifest=@()
$index=0
for($chapter=0;$chapter -lt $paragraphs.Count;$chapter++){
  $sentences=[regex]::Split($paragraphs[$chapter].Trim(), '(?<=[.!?])\s+')
  foreach($sentence in $sentences){
    $filename='line-{0:D3}.wav' -f $index
    $speaker.SetOutputToWaveFile((Join-Path $audioPath $filename))
    $speaker.Speak(($sentence -replace 'TMHub','Tê eme Râb'))
    $speaker.SetOutputToNull()
    $manifest+=@{index=$index;chapter=($chapter+1);text=$sentence;file=$filename}
    $index++
  }
}
$speaker.Dispose()
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $studioPath 'narration.json')
Write-Output "Narration generated: $index sentences in $($paragraphs.Count) chapters."
