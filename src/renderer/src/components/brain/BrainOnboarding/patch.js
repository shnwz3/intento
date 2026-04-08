const fs = require('fs');
const p = 'c:\\Users\\FEROZ RAHIL\\Desktop\\Intento\\intento-app\\src\\renderer\\src\\components\\brain\\BrainOnboarding\\BrainOnboarding.jsx';
let content = fs.readFileSync(p, 'utf8');

const target = "                const extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);";
const replacement = `                let extractRes;
                if (uploadRes.ext === '.pdf') {
                    try {
                        setStatus('Rendering PDF pages (Vision mode)...');
                        const pdfjsLib = await import('pdfjs-dist');
                        pdfjsLib.GlobalWorkerOptions.workerSrc = \`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/\${pdfjsLib.version}/pdf.worker.min.mjs\`;

                        const buffer = await window.intentoAPI.brainReadFileBuffer(uploadRes.filePath);
                        const data = new Uint8Array(buffer);

                        const loadingTask = pdfjsLib.getDocument({ data });
                        const pdf = await loadingTask.promise;
                        
                        const numPages = Math.min(pdf.numPages, 3);
                        const base64Images = [];

                        for (let i = 1; i <= numPages; i++) {
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 2.0 });
                            
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport }).promise;
                            base64Images.push(canvas.toDataURL('image/png'));
                        }
                        
                        setStatus(\`Analyzing \${numPages} pages via Vision AI...\`);
                        extractRes = await window.intentoAPI.brainExtractTagsImages(base64Images);

                    } catch (pdfErr) {
                        console.error('PDF Vision processing failed, falling back to text:', pdfErr);
                        extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
                    }
                } else {
                    extractRes = await window.intentoAPI.brainExtractTags(uploadRes.text);
                }`;

content = content.replace(target, replacement);
fs.writeFileSync(p, content, 'utf8');
