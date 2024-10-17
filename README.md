# TEXT EXTRACTOR (typescript)

## Features
Extract Text from Office Documents and pdf file

## Supported File Extension
- docx
- pptx
- xlsx
- odt
- odp
- ods
- pdf

## Requirements
- Nodejs v20+
- .env file on dist folder (production mode)
- .env file on root folder (development mode)

## Required ENV Variables
- MYSQL_HOST (string)
- MYSQL_PORT (number)
- MYSQL_USER (string)
- MYSQL_PASS (string)
- MYSQL_DATABASE_NAME (string)
- UPLOADED_PATH (string)
- SCHEDULE_PATTERN (string)

## Build Service

```bash
npm run compile
```

## Running Service

```bash
cd dist/
node index.js
```
