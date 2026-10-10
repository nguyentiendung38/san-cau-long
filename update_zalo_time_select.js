const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const generateTimeFunc = `
  const generateTimeOptions = () => {
    const times = [];
    for (let h = 5; h <= 23; h++) {
      const hourStr = h.toString().padStart(2, '0');
      times.push(\`\${hourStr}:00\`);
      times.push(\`\${hourStr}:30\`);
    }
    return times;
  };
`;

code = code.replace(
  'const [bookingDate, setBookingDate] = useState("");',
  `const [bookingDate, setBookingDate] = useState("");\n${generateTimeFunc}`
);

const selectHtml = `
          <select 
            value={bookingTime} 
            onChange={(e) => setBookingTime(e.target.value)} 
            style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1", backgroundColor: "white" }}
          >
            {generateTimeOptions().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
`;

code = code.replace(
  /<input\s+type="time"\s+value=\{bookingTime\}\s+onChange=\{\(e\) => setBookingTime\(e\.target\.value\)\}\s+style=\{\{[^}]+\}\}\s*\/>/,
  selectHtml.trim()
);

// We can remove the hard check for `minute % 30 !== 0` since they are forced to use the select.
code = code.replace(
  /let minute = parseInt\(m\);\s*if \(minute % 30 !== 0\) \{\s*openSnackbar\(\{ type: "warning", text: "[^"]+" \}\);\s*return;\s*\}/,
  ""
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
