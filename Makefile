.PHONY: check

check:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-work-orders.ps1
