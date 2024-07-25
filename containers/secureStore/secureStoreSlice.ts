import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface SecureStoreState {
  sessionCookie: string | null;
  sessionUserEmail: string | null;
}

const initialState: SecureStoreState = {
    sessionCookie: null,
    sessionUserEmail: null,
};

export const secureStoreSlice = createSlice({
  name: 'secureStore',
  initialState,
  reducers: {
    setSessionCookie: (state, { payload }) => {
        state.sessionCookie = payload;
    },
    setSessionUserEmail: (state, { payload }) => {
        state.sessionUserEmail = payload;
    }
  },
});

// Action creators are generated for each case reducer function
export const { setSessionCookie, setSessionUserEmail } = secureStoreSlice.actions;

export default secureStoreSlice.reducer;
