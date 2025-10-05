import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ScannerStats } from '@/lib/types'
import { getScannerStats, getScannerSummary } from '@/lib/api'

interface ScannerState {
    stats: ScannerStats | null
    loading: boolean
    error: string | null
    lastUpdated: number | null
}

const initialState: ScannerState = {
    stats: null,
    loading: false,
    error: null,
    lastUpdated: null,
}

// Async thunks
export const fetchScannerStats = createAsyncThunk(
    'scanner/fetchStats',
    async (scannerUserId: number, { rejectWithValue }) => {
        try {
            return await getScannerStats(scannerUserId)
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch stats')
        }
    }
)

export const fetchScannerSummary = createAsyncThunk(
    'scanner/fetchSummary',
    async (scannerUserId: number, { rejectWithValue }) => {
        try {
            return await getScannerSummary(scannerUserId)
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch summary')
        }
    }
)

const scannerSlice = createSlice({
    name: 'scanner',
    initialState,
    reducers: {
        updateStatsLocally: (state, action: PayloadAction<Partial<ScannerStats>>) => {
            if (state.stats) {
                state.stats = { ...state.stats, ...action.payload }
                state.lastUpdated = Date.now()
            }
        },
        incrementScanCount: (state, action: PayloadAction<{ successful?: boolean; packageCode?: string }>) => {
            if (state.stats) {
                state.stats.totalScans += 1
                if (action.payload.successful) {
                    state.stats.successfulScans += 1

                    // Increment package-specific counts
                    switch (action.payload.packageCode) {
                        case 'INAUGURATION_CEREMONY':
                            state.stats.inaugurationScans += 1
                            break
                        case 'CONFERENCE_DAY_1':
                            state.stats.day1Scans += 1
                            break
                        case 'CONFERENCE_DAY_2':
                            state.stats.day2Scans += 1
                            break
                        case 'FULL_CONFERENCE_PACKAGE':
                            state.stats.fullPackageScans += 1
                            break
                    }
                } else {
                    state.stats.failedScans += 1
                }

                // Recalculate success rate
                if (state.stats.totalScans > 0) {
                    state.stats.successRate = Math.round((state.stats.successfulScans * 10000) / state.stats.totalScans) / 100
                }

                state.stats.lastScanTime = new Date().toISOString()
                state.lastUpdated = Date.now()
            }
        },
        clearError: (state) => {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch Scanner Stats
            .addCase(fetchScannerStats.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchScannerStats.fulfilled, (state, action) => {
                state.loading = false
                state.stats = action.payload
                state.lastUpdated = Date.now()
            })
            .addCase(fetchScannerStats.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
            // Fetch Scanner Summary
            .addCase(fetchScannerSummary.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchScannerSummary.fulfilled, (state, action) => {
                state.loading = false
                state.stats = action.payload
                state.lastUpdated = Date.now()
            })
            .addCase(fetchScannerSummary.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
    },
})

export const { updateStatsLocally, incrementScanCount, clearError } = scannerSlice.actions
export default scannerSlice.reducer