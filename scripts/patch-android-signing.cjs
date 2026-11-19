// Despues de `expo prebuild`: firma el release con el keystore LOCAL de prueba (keystore-local/, fuera de Git).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const gradle = path.join(root, 'android', 'app', 'build.gradle');
const propsFile = path.join(root, 'keystore-local', 'keystore.properties');
if (!fs.existsSync(propsFile)) { console.error('Falta keystore-local/keystore.properties'); process.exit(1); }
let s = fs.readFileSync(gradle, 'utf8');
if (s.includes('ritmoRelease')) { console.log('ya parcheado'); process.exit(0); }
// Windows: ninja falla con rutas >260 caracteres. Se saca el directorio de build de CMake a una ruta corta.
if (process.platform === 'win32') s = s.replace(/\nandroid \{\n/,'\nandroid {\n    externalNativeBuild { cmake { buildStagingDirectory file("D:/ClaudeBrain/cache/c6") } }\n');
const props = propsFile.replace(/\\/g, '/');
s = s.replace(/signingConfigs \{\n/, `signingConfigs {
        ritmoRelease {
            def p = new Properties(); file('${props}').withInputStream { p.load(it) }
            storeFile file(p['storeFile']); storePassword p['storePassword']; keyAlias p['keyAlias']; keyPassword p['keyPassword']
        }
`);
s = s.replace(/(release \{\n\s*\/\/ Caution![^\n]*\n\s*\/\/ see[^\n]*\n\s*)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.ritmoRelease');
fs.writeFileSync(gradle, s);
console.log('parcheado');
