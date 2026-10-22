import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only when both values were filled in the .env file.
export const isConfigured = Boolean(url && key)

// A placeholder URL keeps the app from crashing before .env is filled; the Login page explains what to do.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key')
