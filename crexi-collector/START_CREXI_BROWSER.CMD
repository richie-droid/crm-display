@echo off

REM Opens the collector's Chrome profile on the tracked saved search.
REM Do NOT change the filters on this tab and do not leave a different
REM Crexi saved search open here -- the collector verifies the URL and
REM will now refuse to record a count from any other search.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="%~dp0chrome-profile" ^
  "https://www.crexi.com/search?tableView=true&tenancy.tenancyType_value=Single&searchAttributes.status_tree_Active=&financials.capRatePercent_min=2&searchType=Sales&sorting=listingAttributes.dateActivated_desc_0&showMap=false"
