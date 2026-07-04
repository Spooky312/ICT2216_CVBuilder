import { QRCodeSVG } from 'qrcode.react';
import PropTypes from 'prop-types';

export default function TotpQrCode({ uri }) {
  if (!uri) return null;

  return (
    <div className="totp-setup" aria-label="Two-factor authentication QR code setup">
      <div className="totp-qr-frame">
        <QRCodeSVG
          value={uri}
          size={192}
          level="M"
          marginSize={4}
          title="Scan this QR code with your authenticator app"
        />
      </div>
      <p className="totp-qr-caption">Scan this QR code with your authenticator app.</p>
    </div>
  );
}

TotpQrCode.propTypes = {
  uri: PropTypes.string.isRequired,
};
