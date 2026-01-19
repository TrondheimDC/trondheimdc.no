# Test script to verify all URLs return 200 OK
# Usage: .\tests\test-urls.ps1
# Optional: .\tests\test-urls.ps1 -BaseUrl "http://localhost:4000" -SkipServerStart

param(
    [string]$BaseUrl = "http://localhost:4000",
    [switch]$SkipServerStart = $false,
    [int]$ServerStartTimeout = 15
)

$ErrorActionPreference = "Stop"

# Define all URLs to test (Norwegian and English)
$urls = @(
    # Norwegian pages
    "/",
    "/about/",
    "/cfp/",
    "/coc/",
    "/courses/",
    "/info/",
    "/program/",
    "/speakers/",
    "/tickets/",
    "/vol/",
    
    # English pages
    "/en/",
    "/en/about/",
    "/en/cfp/",
    "/en/coc/",
    "/en/courses/",
    "/en/info/",
    "/en/program/",
    "/en/speakers/",
    "/en/tickets/",
    "/en/vol/"
)

$jekyllProcess = $null
$testsPassed = 0
$testsFailed = 0
$failedUrls = @()

function Write-TestResult {
    param(
        [string]$Url,
        [int]$StatusCode,
        [bool]$Success
    )
    
    if ($Success) {
        Write-Host "[PASS] " -ForegroundColor Green -NoNewline
        Write-Host "$Url - $StatusCode"
    } else {
        Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
        Write-Host "$Url - $StatusCode"
    }
}

try {
    # Start Jekyll server if not skipped
    if (-not $SkipServerStart) {
        Write-Host "`n=== Starting Jekyll server ===" -ForegroundColor Cyan
        
        $jekyllProcess = Start-Process -FilePath "jekyll" -ArgumentList "serve" -PassThru -WindowStyle Hidden
        
        Write-Host "Waiting for server to start..."
        $serverReady = $false
        $attempts = 0
        $maxAttempts = $ServerStartTimeout * 2  # Check every 500ms
        
        while (-not $serverReady -and $attempts -lt $maxAttempts) {
            Start-Sleep -Milliseconds 500
            $attempts++
            try {
                $response = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    $serverReady = $true
                }
            } catch {
                # Server not ready yet
            }
        }
        
        if (-not $serverReady) {
            throw "Jekyll server failed to start within $ServerStartTimeout seconds"
        }
        
        Write-Host "Server is ready!`n" -ForegroundColor Green
    }
    
    # Run tests
    Write-Host "=== Testing URLs ===" -ForegroundColor Cyan
    Write-Host "Base URL: $BaseUrl`n"
    
    foreach ($url in $urls) {
        $fullUrl = "$BaseUrl$url"
        
        try {
            $response = Invoke-WebRequest -Uri $fullUrl -UseBasicParsing -TimeoutSec 10
            $statusCode = $response.StatusCode
            
            if ($statusCode -eq 200) {
                Write-TestResult -Url $url -StatusCode $statusCode -Success $true
                $testsPassed++
            } else {
                Write-TestResult -Url $url -StatusCode $statusCode -Success $false
                $testsFailed++
                $failedUrls += $url
            }
        } catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            Write-TestResult -Url $url -StatusCode $statusCode -Success $false
            $testsFailed++
            $failedUrls += $url
        }
    }
    
    # Summary
    Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
    Write-Host "Total: $($urls.Count) | " -NoNewline
    Write-Host "Passed: $testsPassed " -ForegroundColor Green -NoNewline
    Write-Host "| " -NoNewline
    Write-Host "Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -gt 0) { "Red" } else { "Green" })
    
    if ($failedUrls.Count -gt 0) {
        Write-Host "`nFailed URLs:" -ForegroundColor Red
        foreach ($failedUrl in $failedUrls) {
            Write-Host "  - $failedUrl" -ForegroundColor Red
        }
    }
    
} finally {
    # Stop Jekyll server if we started it
    if ($jekyllProcess -and -not $jekyllProcess.HasExited) {
        Write-Host "`nStopping Jekyll server..." -ForegroundColor Cyan
        Stop-Process -Id $jekyllProcess.Id -Force -ErrorAction SilentlyContinue
        
        # Also kill any ruby processes that might be lingering
        Get-Process -Name "ruby" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# Exit with appropriate code
if ($testsFailed -gt 0) {
    exit 1
} else {
    Write-Host "`nAll tests passed!" -ForegroundColor Green
    exit 0
}
