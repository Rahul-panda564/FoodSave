export const getDonationStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 text-green-800';
    case 'RESERVED':
    case 'ACCEPTED':
      return 'bg-yellow-100 text-yellow-800';
    case 'COLLECTED':
    case 'PICKED_UP':
    case 'DELIVERED':
      return 'bg-blue-100 text-blue-800';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const isDonationExpiringSoon = (expiryTime: string, thresholdHours = 24) => {
  const expiry = new Date(expiryTime);
  const now = new Date();
  const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilExpiry < thresholdHours && hoursUntilExpiry > 0;
};

export const formatLocalDate = (dateString: string) => new Date(dateString).toLocaleDateString();
export const formatLocalDateTime = (dateString: string) => new Date(dateString).toLocaleString();
