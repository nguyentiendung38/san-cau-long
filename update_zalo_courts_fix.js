const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const newCode = `  const handleBookClick = (venue: any) => {
    setSelectedVenue(venue);
    setShowBookingModal(true);
    setCourts([]);
    setSelectedCourt('');
    fetch(\`\${API_URL}/venues/\${venue.id}/availability?date=\${new Date().toISOString()}\`)
      .then(res => res.json())
      .then(data => {
         if (data.success && data.data && data.data.courts) {
            setCourts(data.data.courts);
            if (data.data.courts.length > 0) setSelectedCourt(data.data.courts[0].id);
         }
      })
      .catch(err => {
         console.error('Lỗi tải sân:', err);
      });
  };`;

// Find and replace the function body
code = code.replace(
  /const handleBookClick = \(venue: any\) => \{\s*setSelectedVenue\(venue\);\s*setShowBookingModal\(true\);\s*\};/m,
  newCode
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
