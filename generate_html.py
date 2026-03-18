import markdown

# 1. Read your existing README file
with open("README.md", "r", encoding="utf-8") as f:
    markdown_text = f.read()

# 2. Convert the Markdown to HTML (enabling tables and code blocks)
html_content = markdown.markdown(markdown_text, extensions=['fenced_code', 'tables'])

# 3. Wrap it in a beautiful CSS template so it looks professional
html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project README</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #24292e;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px;
            background-color: #ffffff;
        }}
        h1, h2, h3 {{ border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }}
        pre {{
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            font-family: "Courier New", Courier, monospace;
        }}
        code {{
            background-color: #f6f8fa;
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: "Courier New", Courier, monospace;
            font-size: 85%;
        }}
        pre code {{ background-color: transparent; padding: 0; }}
        table {{ border-collapse: collapse; width: 100%; margin-bottom: 16px; }}
        th, td {{ border: 1px solid #dfe2e5; padding: 6px 13px; }}
        th {{ background-color: #f6f8fa; font-weight: 600; }}
        blockquote {{
            border-left: 0.25em solid #dfe2e5;
            color: #6a737d;
            padding: 0 1em;
            margin: 0;
        }}
        img {{ max-width: 100%; box-sizing: content-box; }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>
"""

# 4. Save the final HTML file
with open("README.html", "w", encoding="utf-8") as f:
    f.write(html_template)

print("✅ Success! README.html has been generated.")