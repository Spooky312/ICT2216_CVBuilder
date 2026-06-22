import React, { useEffect, useState } from 'react';
import FieldError, { errorProps } from '../common/FieldError';

const COUNTRY_CODES = [
  ['+1', 'North America & Caribbean'],
  ['+7', 'Russia & Kazakhstan'],
  ['+20', 'Egypt'], ['+27', 'South Africa'],
  ['+30', 'Greece'], ['+31', 'Netherlands'], ['+32', 'Belgium'], ['+33', 'France'],
  ['+34', 'Spain'], ['+36', 'Hungary'], ['+39', 'Italy & Vatican City'],
  ['+40', 'Romania'], ['+41', 'Switzerland'], ['+43', 'Austria'], ['+44', 'United Kingdom'],
  ['+45', 'Denmark'], ['+46', 'Sweden'], ['+47', 'Norway & Svalbard'],
  ['+48', 'Poland'], ['+49', 'Germany'],
  ['+51', 'Peru'], ['+52', 'Mexico'], ['+53', 'Cuba'], ['+54', 'Argentina'],
  ['+55', 'Brazil'], ['+56', 'Chile'], ['+57', 'Colombia'], ['+58', 'Venezuela'],
  ['+60', 'Malaysia'], ['+61', 'Australia'], ['+62', 'Indonesia'],
  ['+63', 'Philippines'], ['+64', 'New Zealand'], ['+65', 'Singapore'], ['+66', 'Thailand'],
  ['+81', 'Japan'], ['+82', 'South Korea'], ['+84', 'Vietnam'], ['+86', 'China'],
  ['+90', 'Türkiye'], ['+91', 'India'], ['+92', 'Pakistan'], ['+93', 'Afghanistan'],
  ['+94', 'Sri Lanka'], ['+95', 'Myanmar'], ['+98', 'Iran'],
  ['+211', 'South Sudan'], ['+212', 'Morocco & Western Sahara'], ['+213', 'Algeria'],
  ['+216', 'Tunisia'], ['+218', 'Libya'], ['+220', 'Gambia'], ['+221', 'Senegal'],
  ['+222', 'Mauritania'], ['+223', 'Mali'], ['+224', 'Guinea'], ['+225', "Côte d'Ivoire"],
  ['+226', 'Burkina Faso'], ['+227', 'Niger'], ['+228', 'Togo'], ['+229', 'Benin'],
  ['+230', 'Mauritius'], ['+231', 'Liberia'], ['+232', 'Sierra Leone'], ['+233', 'Ghana'],
  ['+234', 'Nigeria'], ['+235', 'Chad'], ['+236', 'Central African Republic'],
  ['+237', 'Cameroon'], ['+238', 'Cabo Verde'], ['+239', 'São Tomé & Príncipe'],
  ['+240', 'Equatorial Guinea'], ['+241', 'Gabon'], ['+242', 'Republic of the Congo'],
  ['+243', 'DR Congo'], ['+244', 'Angola'], ['+245', 'Guinea-Bissau'],
  ['+246', 'British Indian Ocean Territory'], ['+247', 'Ascension Island'],
  ['+248', 'Seychelles'], ['+249', 'Sudan'], ['+250', 'Rwanda'], ['+251', 'Ethiopia'],
  ['+252', 'Somalia'], ['+253', 'Djibouti'], ['+254', 'Kenya'], ['+255', 'Tanzania'],
  ['+256', 'Uganda'], ['+257', 'Burundi'], ['+258', 'Mozambique'], ['+260', 'Zambia'],
  ['+261', 'Madagascar'], ['+262', 'Réunion & Mayotte'], ['+263', 'Zimbabwe'],
  ['+264', 'Namibia'], ['+265', 'Malawi'], ['+266', 'Lesotho'], ['+267', 'Botswana'],
  ['+268', 'Eswatini'], ['+269', 'Comoros'],
  ['+290', 'Saint Helena & Tristan da Cunha'], ['+291', 'Eritrea'], ['+297', 'Aruba'],
  ['+298', 'Faroe Islands'], ['+299', 'Greenland'],
  ['+350', 'Gibraltar'], ['+351', 'Portugal'], ['+352', 'Luxembourg'], ['+353', 'Ireland'],
  ['+354', 'Iceland'], ['+355', 'Albania'], ['+356', 'Malta'], ['+357', 'Cyprus'],
  ['+358', 'Finland & Åland'], ['+359', 'Bulgaria'],
  ['+370', 'Lithuania'], ['+371', 'Latvia'], ['+372', 'Estonia'], ['+373', 'Moldova'],
  ['+374', 'Armenia'], ['+375', 'Belarus'], ['+376', 'Andorra'], ['+377', 'Monaco'],
  ['+378', 'San Marino'], ['+380', 'Ukraine'], ['+381', 'Serbia'], ['+382', 'Montenegro'],
  ['+383', 'Kosovo'], ['+385', 'Croatia'], ['+386', 'Slovenia'],
  ['+387', 'Bosnia & Herzegovina'], ['+389', 'North Macedonia'],
  ['+420', 'Czechia'], ['+421', 'Slovakia'], ['+423', 'Liechtenstein'],
  ['+500', 'Falkland Islands'], ['+501', 'Belize'], ['+502', 'Guatemala'],
  ['+503', 'El Salvador'], ['+504', 'Honduras'], ['+505', 'Nicaragua'],
  ['+506', 'Costa Rica'], ['+507', 'Panama'], ['+508', 'Saint Pierre & Miquelon'],
  ['+509', 'Haiti'],
  ['+590', 'Guadeloupe, Saint Barthélemy & Saint Martin'], ['+591', 'Bolivia'],
  ['+592', 'Guyana'], ['+593', 'Ecuador'], ['+594', 'French Guiana'],
  ['+595', 'Paraguay'], ['+596', 'Martinique'], ['+597', 'Suriname'],
  ['+598', 'Uruguay'], ['+599', 'Caribbean Netherlands & Curaçao'],
  ['+670', 'Timor-Leste'], ['+672', 'Australian External Territories'], ['+673', 'Brunei'],
  ['+674', 'Nauru'], ['+675', 'Papua New Guinea'], ['+676', 'Tonga'],
  ['+677', 'Solomon Islands'], ['+678', 'Vanuatu'], ['+679', 'Fiji'], ['+680', 'Palau'],
  ['+681', 'Wallis & Futuna'], ['+682', 'Cook Islands'], ['+683', 'Niue'],
  ['+685', 'Samoa'], ['+686', 'Kiribati'], ['+687', 'New Caledonia'],
  ['+688', 'Tuvalu'], ['+689', 'French Polynesia'], ['+690', 'Tokelau'],
  ['+691', 'Micronesia'], ['+692', 'Marshall Islands'],
  ['+850', 'North Korea'], ['+852', 'Hong Kong'], ['+853', 'Macao'],
  ['+855', 'Cambodia'], ['+856', 'Laos'], ['+880', 'Bangladesh'], ['+886', 'Taiwan'],
  ['+960', 'Maldives'], ['+961', 'Lebanon'], ['+962', 'Jordan'], ['+963', 'Syria'],
  ['+964', 'Iraq'], ['+965', 'Kuwait'], ['+966', 'Saudi Arabia'], ['+967', 'Yemen'],
  ['+968', 'Oman'], ['+970', 'Palestine'], ['+971', 'United Arab Emirates'],
  ['+972', 'Israel'], ['+973', 'Bahrain'], ['+974', 'Qatar'], ['+975', 'Bhutan'],
  ['+976', 'Mongolia'], ['+977', 'Nepal'],
  ['+992', 'Tajikistan'], ['+993', 'Turkmenistan'], ['+994', 'Azerbaijan'],
  ['+995', 'Georgia'], ['+996', 'Kyrgyzstan'], ['+998', 'Uzbekistan'],
];

const ISO_BY_CALLING_CODE = {
  '+1': 'USA/CAN', '+7': 'RUS/KAZ', '+20': 'EGY', '+27': 'ZAF',
  '+30': 'GRC', '+31': 'NLD', '+32': 'BEL', '+33': 'FRA', '+34': 'ESP',
  '+36': 'HUN', '+39': 'ITA/VAT', '+40': 'ROU', '+41': 'CHE', '+43': 'AUT',
  '+44': 'GBR', '+45': 'DNK', '+46': 'SWE', '+47': 'NOR/SJM', '+48': 'POL',
  '+49': 'DEU', '+51': 'PER', '+52': 'MEX', '+53': 'CUB', '+54': 'ARG',
  '+55': 'BRA', '+56': 'CHL', '+57': 'COL', '+58': 'VEN', '+60': 'MYS',
  '+61': 'AUS', '+62': 'IDN', '+63': 'PHL', '+64': 'NZL', '+65': 'SGP',
  '+66': 'THA', '+81': 'JPN', '+82': 'KOR', '+84': 'VNM', '+86': 'CHN',
  '+90': 'TUR', '+91': 'IND', '+92': 'PAK', '+93': 'AFG', '+94': 'LKA',
  '+95': 'MMR', '+98': 'IRN', '+211': 'SSD', '+212': 'MAR/ESH', '+213': 'DZA',
  '+216': 'TUN', '+218': 'LBY', '+220': 'GMB', '+221': 'SEN', '+222': 'MRT',
  '+223': 'MLI', '+224': 'GIN', '+225': 'CIV', '+226': 'BFA', '+227': 'NER',
  '+228': 'TGO', '+229': 'BEN', '+230': 'MUS', '+231': 'LBR', '+232': 'SLE',
  '+233': 'GHA', '+234': 'NGA', '+235': 'TCD', '+236': 'CAF', '+237': 'CMR',
  '+238': 'CPV', '+239': 'STP', '+240': 'GNQ', '+241': 'GAB', '+242': 'COG',
  '+243': 'COD', '+244': 'AGO', '+245': 'GNB', '+246': 'IOT', '+247': 'SHN',
  '+248': 'SYC', '+249': 'SDN', '+250': 'RWA', '+251': 'ETH', '+252': 'SOM',
  '+253': 'DJI', '+254': 'KEN', '+255': 'TZA', '+256': 'UGA', '+257': 'BDI',
  '+258': 'MOZ', '+260': 'ZMB', '+261': 'MDG', '+262': 'REU/MYT', '+263': 'ZWE',
  '+264': 'NAM', '+265': 'MWI', '+266': 'LSO', '+267': 'BWA', '+268': 'SWZ',
  '+269': 'COM', '+290': 'SHN', '+291': 'ERI', '+297': 'ABW', '+298': 'FRO',
  '+299': 'GRL', '+350': 'GIB', '+351': 'PRT', '+352': 'LUX', '+353': 'IRL',
  '+354': 'ISL', '+355': 'ALB', '+356': 'MLT', '+357': 'CYP', '+358': 'FIN/ALA',
  '+359': 'BGR', '+370': 'LTU', '+371': 'LVA', '+372': 'EST', '+373': 'MDA',
  '+374': 'ARM', '+375': 'BLR', '+376': 'AND', '+377': 'MCO', '+378': 'SMR',
  '+380': 'UKR', '+381': 'SRB', '+382': 'MNE', '+383': 'XKX', '+385': 'HRV',
  '+386': 'SVN', '+387': 'BIH', '+389': 'MKD', '+420': 'CZE', '+421': 'SVK',
  '+423': 'LIE', '+500': 'FLK', '+501': 'BLZ', '+502': 'GTM', '+503': 'SLV',
  '+504': 'HND', '+505': 'NIC', '+506': 'CRI', '+507': 'PAN', '+508': 'SPM',
  '+509': 'HTI', '+590': 'GLP/BLM/MAF', '+591': 'BOL', '+592': 'GUY',
  '+593': 'ECU', '+594': 'GUF', '+595': 'PRY', '+596': 'MTQ', '+597': 'SUR',
  '+598': 'URY', '+599': 'BES/CUW', '+670': 'TLS', '+672': 'NFK/ATA',
  '+673': 'BRN', '+674': 'NRU', '+675': 'PNG', '+676': 'TON', '+677': 'SLB',
  '+678': 'VUT', '+679': 'FJI', '+680': 'PLW', '+681': 'WLF', '+682': 'COK',
  '+683': 'NIU', '+685': 'WSM', '+686': 'KIR', '+687': 'NCL', '+688': 'TUV',
  '+689': 'PYF', '+690': 'TKL', '+691': 'FSM', '+692': 'MHL', '+850': 'PRK',
  '+852': 'HKG', '+853': 'MAC', '+855': 'KHM', '+856': 'LAO', '+880': 'BGD',
  '+886': 'TWN', '+960': 'MDV', '+961': 'LBN', '+962': 'JOR', '+963': 'SYR',
  '+964': 'IRQ', '+965': 'KWT', '+966': 'SAU', '+967': 'YEM', '+968': 'OMN',
  '+970': 'PSE', '+971': 'ARE', '+972': 'ISR', '+973': 'BHR', '+974': 'QAT',
  '+975': 'BTN', '+976': 'MNG', '+977': 'NPL', '+992': 'TJK', '+993': 'TKM',
  '+994': 'AZE', '+995': 'GEO', '+996': 'KGZ', '+998': 'UZB',
};

function CountryCodeCombobox({ value, onChange, onBlur }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const normalisedQuery = query.trim().toLowerCase();
  const filteredCodes = COUNTRY_CODES.filter(([code, country]) => {
    const iso = ISO_BY_CALLING_CODE[code] || '';
    return !normalisedQuery
      || code.includes(normalisedQuery)
      || country.toLowerCase().includes(normalisedQuery)
      || iso.toLowerCase().includes(normalisedQuery);
  });
  const selectedLabel = value
    ? `${value} ${ISO_BY_CALLING_CODE[value] || 'Current'}`
    : '';

  const selectCode = (code) => {
    onChange(code);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, filteredCodes.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filteredCodes[activeIndex]) {
      event.preventDefault();
      selectCode(filteredCodes[activeIndex][0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="country-code-combobox">
      <input id="personal-country-code" type="text" role="combobox"
        value={open ? query : selectedLabel}
        onFocus={(event) => {
          setQuery('');
          setActiveIndex(0);
          setOpen(true);
          event.target.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setOpen(false);
          setQuery('');
          onBlur();
        }}
        placeholder="Search country"
        autoComplete="off"
        aria-label="Search country calling code"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="country-code-listbox"
        aria-activedescendant={open && filteredCodes[activeIndex]
          ? `country-code-option-${activeIndex}` : undefined}
      />
      <span className="country-code-chevron" aria-hidden="true">⌄</span>
      {open && (
        <div id="country-code-listbox" className="country-code-options" role="listbox">
          {filteredCodes.length === 0 ? (
            <span className="country-code-empty">No countries found</span>
          ) : filteredCodes.map(([code, country], index) => (
            <button id={`country-code-option-${index}`} key={code} type="button" role="option"
              aria-selected={value === code} aria-label={`${country}, ${code}, ${ISO_BY_CALLING_CODE[code]}`}
              className={`${index === activeIndex ? 'active' : ''} ${value === code ? 'selected' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectCode(code)}>
              <span>{code}</span><strong>{ISO_BY_CALLING_CODE[code]}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function splitPhone(value) {
  const clean = String(value || '').trim();
  const match = clean.match(/^(\+\d{1,4})(?:\s+|(?=\())(.*)$/);
  if (match) return { code: match[1], number: match[2].trim() };
  return { code: clean ? '' : '+65', number: clean };
}

function combinePhone(code, number) {
  const cleanNumber = number.trim();
  if (!cleanNumber) return '';
  return `${code.trim()} ${cleanNumber}`.trim();
}

export default function PhoneInput({ value, onChange, onBlur, errors }) {
  const initial = splitPhone(value);
  const [countryCode, setCountryCode] = useState(initial.code);
  const [localNumber, setLocalNumber] = useState(initial.number);

  useEffect(() => {
    if (!value && !localNumber) return;
    const parsed = splitPhone(value);
    setCountryCode(parsed.code);
    setLocalNumber(parsed.number);
    // The parent owns the combined value; localNumber is intentionally excluded
    // so clearing a number does not reset the user's chosen country code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const updateCode = (nextCode) => {
    setCountryCode(nextCode);
    onChange(combinePhone(nextCode, localNumber));
  };

  const updateNumber = (nextNumber) => {
    setLocalNumber(nextNumber);
    onChange(combinePhone(countryCode, nextNumber));
  };

  return (
    <fieldset className="phone-fieldset">
      <legend>Phone</legend>
      <div className="phone-input-row">
        <div>
          <label htmlFor="personal-country-code">Country code</label>
          <CountryCodeCombobox value={countryCode} onChange={updateCode} onBlur={onBlur} />
        </div>
        <div>
          <label htmlFor="personal-phone">Phone number</label>
          <input id="personal-phone" type="tel" value={localNumber}
            onChange={(event) => updateNumber(event.target.value)} onBlur={onBlur}
            maxLength={Math.max(7, 19 - countryCode.length)} placeholder="9123 4567"
            inputMode="tel" {...errorProps(errors, 'phone', 'personal-phone')} />
        </div>
      </div>
      <small className="field-hint">The country code and number will be saved together on your resume.</small>
      <FieldError errors={errors} name="phone" inputId="personal-phone" />
    </fieldset>
  );
}
