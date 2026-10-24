import { supabase } from './supabase'

// Every important action is written to the audit log; this is what the History panel shows.
export async function logAudit(actorId, action, itemId, details = {}) {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: actorId,
    action,
    entity: 'content_item',
    entity_id: String(itemId),
    details,
  })
  if (error) console.error('Could not write the audit log:', error.message)
}
