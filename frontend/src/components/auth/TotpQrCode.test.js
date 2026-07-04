import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TotpQrCode from './TotpQrCode';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props) => <svg data-testid="qr-svg" data-value={props.value} />,
}));

describe('TotpQrCode', () => {
  it('renders nothing when no uri is given', () => {
    const { container } = render(<TotpQrCode uri="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the QR code and caption when a uri is given', () => {
    render(<TotpQrCode uri="otpauth://totp/example" />);
    expect(screen.getByText('Scan this QR code with your authenticator app.')).toBeInTheDocument();
    expect(screen.getByTestId('qr-svg')).toHaveAttribute('data-value', 'otpauth://totp/example');
  });
});
