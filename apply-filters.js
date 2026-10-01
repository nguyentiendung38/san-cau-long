const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

// Add filterMode state
const stateInject = `
    const [filterMode, setFilterMode] = useState<'all' | 'booked' | 'favorite'>('all');
`;

if (!content.includes('const [filterMode, setFilterMode]')) {
    content = content.replace('const [searchQuery, setSearchQuery] = useState(\'\');', 'const [searchQuery, setSearchQuery] = useState(\'\');' + stateInject);
}

// Modify filteredVenues
const oldFiltered = `const filteredVenues = venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.address?.toLowerCase().includes(searchQuery.toLowerCase()));`;
const newFiltered = `const filteredVenues = venues.filter(v => {
        const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || (v.address && v.address.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
        
        if (filterMode === 'favorite') {
            return favoriteVenueIds.includes(v.id);
        }
        if (filterMode === 'booked') {
            return bookedVenueIds.includes(v.id);
        }
        return true;
    });`;

if (content.includes(oldFiltered)) {
    content = content.replace(oldFiltered, newFiltered);
} else {
    const filteredRegex = /const filteredVenues = venues\.filter.*?;\n?/s;
    content = content.replace(filteredRegex, newFiltered + '\n');
}

// Modify Booked button
const oldBookedBtn = `<button className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <CalendarCheck className="w-4 h-4" />
                                <span>Sân ð? ð?t</span>
                            </button>`;
const newBookedBtn = `<button onClick={() => setFilterMode(prev => prev === 'booked' ? 'all' : 'booked')} className={\`flex items-center gap-1.5 transition-colors whitespace-nowrap \${filterMode === 'booked' ? 'text-[#19b251] font-medium' : 'hover:text-[#19b251] text-gray-700'}\`}>
                                <CalendarCheck className="w-4 h-4" />
                                <span>Sân ð? ð?t</span>
                            </button>`;
content = content.replace(oldBookedBtn, newBookedBtn);

// Modify Favorite button
const oldFavBtn = `<button className="flex items-center gap-1.5 hover:text-[#19b251] transition-colors whitespace-nowrap">
                                <Heart className="w-4 h-4" />
                                <span>Yêu thích</span>
                            </button>`;
const newFavBtn = `<button onClick={() => setFilterMode(prev => prev === 'favorite' ? 'all' : 'favorite')} className={\`flex items-center gap-1.5 transition-colors whitespace-nowrap \${filterMode === 'favorite' ? 'text-[#19b251] font-medium' : 'hover:text-[#19b251] text-gray-700'}\`}>
                                <Heart className={\`w-4 h-4 \${filterMode === 'favorite' ? 'fill-[#19b251]' : ''}\`} />
                                <span>Yêu thích</span>
                            </button>`;
content = content.replace(oldFavBtn, newFavBtn);

fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Filters applied");
