const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const oldCode = `(status === 'booked' || status === 'past') && "bg-gray-100 text-gray-400 border-gray-100 opacity-60 cursor-not-allowed"
                                                    )}
                                                aria-label={\`\${time} đến \${getNextHalfHour(time)}\`}
                                                >
                                                    {formatSlotTime(time)}
                                                </button>`;

const newCode = `status === 'past' && "bg-gray-100 text-gray-400 border-gray-100 opacity-60 cursor-not-allowed",
                                                        status === 'booked' && "bg-red-50 text-red-500 border-red-200 cursor-not-allowed"
                                                    )}
                                                aria-label={\`\${time} đến \${getNextHalfHour(time)}\`}
                                                >
                                                    {status === 'booked' && <X className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />}
                                                    {formatSlotTime(time)}
                                                </button>`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
