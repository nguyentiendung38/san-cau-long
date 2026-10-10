const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', 'utf8');

const oldCondition = "{req.status === 'PENDING' && (";
const newCondition = `{req.status === 'PENDING' && req.paymentMethod !== 'VNPAY' && (`;

code = code.replace(oldCondition, newCondition);

const newVnpayText = `
                                      {req.status === 'PENDING' && req.paymentMethod === 'VNPAY' && (
                                          <div className="bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center text-center">
                                              Chờ khách thanh toán qua VNPAY...
                                          </div>
                                      )}
`;

code = code.replace(
  '                                    <button onClick={() => deleteMutation.mutate(req.id)}',
  newVnpayText + '                                      <button onClick={() => deleteMutation.mutate(req.id)}'
);

fs.writeFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', code);
