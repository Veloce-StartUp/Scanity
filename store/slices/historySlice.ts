// store/slices/historySlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ScanHistoryItem } from '@/lib/types'
import { getScannerHistory } from '@/lib/api'

interface HistoryState {
    items: ScanHistoryItem[]
    loading: boolean
    error: string | null
    hasMore: boolean
    currentPage: number
}

const initialState: HistoryState = {
    items: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 0,
}

// Async thunks
export const fetchScannerHistory = createAsyncThunk(
    'history/fetchHistory',
    async ({ scannerUserId, page = 0 }: { scannerUserId: number; page?: number }, { rejectWithValue }) => {
        try {
            const history = await getScannerHistory(scannerUserId, page, 20)
            return { history, page, hasMore: history.length === 20 }
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch history')
        }
    }
)

const historySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        addHistoryItem: (state, action: PayloadAction<ScanHistoryItem>) => {
            state.items.unshift(action.payload)
            // Keep only last 100 items in memory
            if (state.items.length > 100) {
                state.items = state.items.slice(0, 100)
            }
        },
        updateHistoryItem: (state, action: PayloadAction<{ id: number; updates: Partial<ScanHistoryItem> }>) => {
            const index = state.items.findIndex(item => item.id === action.payload.id)
            if (index !== -1) {
                state.items[index] = { ...state.items[index], ...action.payload.updates }
            }
        },
        clearHistory: (state) => {
            state.items = []
            state.currentPage = 0
            state.hasMore = true
        },
        clearError: (state) => {
            state.error = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchScannerHistory.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchScannerHistory.fulfilled, (state, action) => {
                state.loading = false
                if (action.payload.page === 0) {
                    state.items = action.payload.history
                } else {
                    state.items = [...state.items, ...action.payload.history]
                }
                state.currentPage = action.payload.page
                state.hasMore = action.payload.hasMore
            })
            .addCase(fetchScannerHistory.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
    },
})

export const { addHistoryItem, updateHistoryItem, clearHistory, clearError } = historySlice.actions
export default historySlice.reducer