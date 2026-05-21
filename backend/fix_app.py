import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

helper = """
def get_supabase():
    auth_header = request.headers.get("Authorization")
    if auth_header and SUPABASE_URL and SUPABASE_KEY:
        from supabase import ClientOptions
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(headers={"Authorization": auth_header}))
    return supabase

"""

content = content.replace('emotion_pipeline = None', helper + 'emotion_pipeline = None')
content = content.replace('supabase.table', 'get_supabase().table')

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
