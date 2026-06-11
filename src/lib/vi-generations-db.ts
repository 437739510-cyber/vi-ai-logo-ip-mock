import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_KEY!

export interface ViGeneration {
  id: string
  project_id: string
  format: 'pptx' | 'pdf'
  status: 'generating' | 'completed' | 'failed'
  storage_url?: string
  download_url?: string
  file_name: string
  file_size: number
  page_count: number
  selected_logo_url?: string
  scene_image_count: number
  error?: string
  created_at: string
  completed_at?: string
}

export async function createViGenerationRecord(
  projectId: string,
  format: 'pptx' | 'pdf'
): Promise<ViGeneration> {
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('vi_generations')
    .insert({
      project_id: projectId,
      format,
      status: 'generating',
      file_name: '',
      file_size: 0,
      page_count: 0,
      scene_image_count: 0,
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateViGenerationRecord(
  id: string,
  updates: Partial<ViGeneration>
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase
    .from('vi_generations')
    .update({ ...updates, completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined })
    .eq('id', id)
  
  if (error) throw error
}

export async function listViGenerations(
  projectId: string,
  limit = 10
): Promise<ViGeneration[]> {
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('vi_generations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

export async function deleteViGeneration(id: string): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceKey)
  
  // Delete from Storage first
  const { data: record } = await supabase
    .from('vi_generations')
    .select('storage_url')
    .eq('id', id)
    .single()
  
  if (record?.storage_url) {
    const path = record.storage_url.split('/').pop()
    await supabase.storage.from('vi-manuals').remove([path!])
  }
  
  // Delete record
  const { error } = await supabase
    .from('vi_generations')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
