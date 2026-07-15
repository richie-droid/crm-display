@echo off

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%~dp0chrome-profile" ^
  "https://www.crexi.com/properties?capRateMin=2&tenancies%%5B%%5D=Single"