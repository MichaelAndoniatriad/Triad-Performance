const fs = require('fs');
const path = require('path');

// Load .env from project root (simple parse, no external deps)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
  let pendingKey = null;
  content.split(/\r?\n/).forEach((line) => {
    const exportMatch = line.match(/^\s*export\s+(.+)$/);
    const lineToParse = exportMatch ? exportMatch[1] : line;
    const match = lineToParse.match(/^\s*([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
      process.env[key] = value;
      if (!value && (key === 'SUPABASE_URL' || key === 'SUPABASE_ANON_KEY')) {
        pendingKey = key;
      } else {
        pendingKey = null;
      }
    } else if (pendingKey && lineToParse.trim() && !lineToParse.trim().startsWith('#')) {
      // Handle values accidentally placed on the next line
      const nextValue = lineToParse.trim().replace(/^["']|["']$/g, '');
      process.env[pendingKey] = nextValue;
      pendingKey = null;
    }
  });
}

const questionnaireTemplatePath = path.join(__dirname, '..', 'public', 'questionnaire.template.html');
const questionnaireOutputPath = path.join(__dirname, '..', 'public', 'questionnaire.html');
const enquireTemplatePath = path.join(__dirname, '..', 'public', 'enquire.template.html');
const enquireOutputPath = path.join(__dirname, '..', 'public', 'enquire.html');
// Prefer SUPABASE_URL / SUPABASE_ANON_KEY; allow VITE_ variants
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Debug: show what was loaded (no secrets)
const envKeys = Object.keys(process.env).filter((k) => k.includes('SUPABASE'));
if (envKeys.length) console.log('Env keys found:', envKeys.join(', '));
console.log('SUPABASE_URL length:', url.length, '| SUPABASE_ANON_KEY length:', key.length);

if (!url || !key) {
  console.warn('WARNING: SUPABASE_URL and SUPABASE_ANON_KEY are present but values are empty.');
  console.warn('Put the full values on the same line (no line break after =), then run npm run build again.');
  console.warn('Example .env:');
  console.warn('  SUPABASE_URL=https://abcdefgh.supabase.co');
  console.warn('  SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
}

function escapeForJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildTemplate(templatePath, outputPath, label) {
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html.replace(/__SUPABASE_URL__/g, escapeForJsString(url));
  html = html.replace(/__SUPABASE_ANON_KEY__/g, escapeForJsString(key));
  fs.writeFileSync(outputPath, html);
  console.log(`Built ${label} with Supabase config from .env`);
}

buildTemplate(questionnaireTemplatePath, questionnaireOutputPath, 'public/questionnaire.html');
buildTemplate(enquireTemplatePath, enquireOutputPath, 'public/enquire.html');
