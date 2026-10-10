const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const detailModalUI = `
      {/* Modal Chi Tiet Co So */}
      <Modal
        visible={showDetailModal}
        title="Thông tin cơ sở"
        onClose={() => setShowDetailModal(false)}
      >
        <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {venueDetail ? (
            <Box>
              <Text.Title size="small">{venueDetail.name}</Text.Title>
              <Text size="xSmall" style={{ color: '#64748B', marginBottom: '16px' }}>{venueDetail.address}</Text>
              
              <Text size="small" bold>Giờ mở cửa chung:</Text>
              <Text size="xSmall" style={{ marginBottom: '16px' }}>{venueDetail.openTime} - {venueDetail.closeTime}</Text>
              
              {venueDetail.operatingHours && venueDetail.operatingHours.length > 0 && (
                <Box mb={4}>
                  <Text size="small" bold>Lịch hoạt động chi tiết:</Text>
                  {venueDetail.operatingHours.map((oh) => (
                    <Text size="xSmall" key={oh.id}>• Thứ {oh.daysOfWeek}: {oh.startTime} - {oh.endTime}</Text>
                  ))}
                </Box>
              )}
              
              {venueDetail.pricingRules && venueDetail.pricingRules.length > 0 && (
                <Box mb={4}>
                  <Text size="small" bold>Bảng giá tham khảo:</Text>
                  {venueDetail.pricingRules.map((pr) => (
                    <Box key={pr.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text size="xSmall">• {pr.name} ({pr.startTime}-{pr.endTime}):</Text>
                      <Text size="xSmall" bold>{new Intl.NumberFormat('vi-VN').format(pr.pricePerHour)}đ/h</Text>
                    </Box>
                  ))}
                </Box>
              )}
              
              <Button 
                variant="primary" 
                fullWidth 
                onClick={() => {
                  setShowDetailModal(false);
                  handleBookClick(venueDetail);
                }}
              >
                Tiếp tục Đặt sân ngay
              </Button>
            </Box>
          ) : (
            <Text className="text-center text-gray-500">Đang tải thông tin chi tiết...</Text>
          )}
        </Box>
      </Modal>
`;

const modalTagIndex = code.indexOf('<Modal');
if (modalTagIndex > -1) {
  code = code.slice(0, modalTagIndex) + detailModalUI + code.slice(modalTagIndex);
}

// Replace the strange encoding button text
code = code.replace(/<Button size="small" fullWidth onClick=\{\(\) => handleViewDetail\(venue\)\}>\s*[^<]+\s*<\/Button>/g, '<Button size="small" fullWidth onClick={() => handleViewDetail(venue)}>Xem chi tiết & Đặt sân</Button>');
code = code.replace(/<Button size="small" fullWidth onClick=\{\(\) => handleBookClick\(venue\)\}>\s*[^<]+\s*<\/Button>/g, '<Button size="small" fullWidth onClick={() => handleViewDetail(venue)}>Xem chi tiết & Đặt sân</Button>');


fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
