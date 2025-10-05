import { configureStore } from '@reduxjs/toolkit'
import scannerReducer from './slices/scannerSlice'
import historyReducer from './slices/historySlice'

export const store = configureStore({
    reducer: {
        scanner: scannerReducer,
        history: historyReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['persist/PERSIST'],
            },
        }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch