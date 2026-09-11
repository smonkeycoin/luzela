-- Add normalized pending status before transactional email event migration uses it.

alter type public.message_status add value if not exists 'pending';
