import { BigNumber, constants, utils, providers } from 'ethers';
import { updateImmutably } from '../../chain-data';
import { GO_ERROR_INDEX, GO_RESULT_INDEX } from '../../utils';
import {
  decodeEvmScript,
  decodeMetadata,
  decodeProposalTypeAndId,
  encodeEvmScript,
  encodeMetadata,
  encodeProposalTypeAndId,
  METADATA_DELIMETER,
} from './encoding';

const newFormData = {
  targetSignature: 'functionName(string,uint256)',
  description: 'My description',
  title: 'My title',
  parameters: JSON.stringify(['arg1', 123]),
  targetAddress: '0xB97F3A052d5562437e42EDeEBd1afec2376666eD',
  targetValue: '12',
  type: 'primary' as const,
};
const api3Agent = {
  primary: '0xd001cbCb278dDb424964e894a98d26bBdd4A8679',
  secondary: '0xb46863F7014D6F100F67Af778d660647f9Fc96ff',
};

const MOCKED_ENS_ENTRY = { ensName: 'api3-mocked.eth', address: '0xe97D5D255Dc4458477f7E435c3aF0d8bd07231eA' };
const mockedProvider: providers.JsonRpcProvider = {
  resolveName: (name: string) => {
    return Promise.resolve(name === MOCKED_ENS_ENTRY.ensName ? MOCKED_ENS_ENTRY.address : null);
  },
  lookupAddress: (address: string) => {
    return Promise.resolve(address === MOCKED_ENS_ENTRY.address ? MOCKED_ENS_ENTRY.ensName : null);
  },
} as any;

describe('metadata', () => {
  test('encoding', () => {
    expect(encodeMetadata(newFormData)).toBe(
      // There is not a nice way to test it because METADATA_DELIMETER is non printable character
      ['1', 'functionName(string,uint256)', 'My title', 'My description'].join(METADATA_DELIMETER)
    );
  });

  test('decoding', () => {
    const encodedMetadata = encodeMetadata(newFormData);
    expect(decodeMetadata(encodedMetadata)).toEqual({
      description: 'My description',
      targetSignature: 'functionName(string,uint256)',
      title: 'My title',
      version: '1',
    });
  });

  test('decoding invalid (separated by reserved delimiter)', () => {
    const invalidData = {
      ...newFormData,
      description: 'separated by reserved delimiter'.split(' ').join(METADATA_DELIMETER),
    };
    const metadata = decodeMetadata(encodeMetadata(invalidData));

    expect(metadata).toEqual(null);
  });
});

describe('EVM script', () => {
  test('correct encoding', async () => {
    const encoded = await encodeEvmScript(mockedProvider, newFormData, api3Agent);
    expect(encoded[GO_ERROR_INDEX]).toBeNull();
    expect(encoded[GO_RESULT_INDEX]).toBeDefined();
  });

  describe('encoding incorrect params', () => {
    it('incorrect parameter values', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.parameters = JSON.stringify([123, 'arg1']); // they are in the wrong order
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'parameters',
        value: 'Ensure parameters match target contract signature',
      });
    });

    it('wrong shape', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.parameters = JSON.stringify({ param: 'value' });
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'parameters',
        value: 'Make sure parameters is a valid JSON array',
      });
    });

    it('empty parameters', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.parameters = '';
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'parameters',
        value: 'Make sure parameters is a valid JSON array',
      });
    });

    it('wrong number of parameters', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.parameters = JSON.stringify(['arg1']);
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'parameters',
        value: 'Please specify the correct number of function arguments',
      });
    });
  });

  describe('encoding invalid target signature', () => {
    it('detects parameter type typo', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.targetSignature = 'functionName(string,unit256)';
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'parameters',
        value: 'Ensure parameters match target contract signature',
      });
    });

    it('detects when the function is unnecessarily quoted', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.targetSignature = '"functionName(string,unit256)"';
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'targetSignature',
        value: 'Please specify a valid contract signature',
      });
    });
  });

  describe('address validation', () => {
    it('checks for valid account address', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.targetAddress = 'surely-not-an-address';
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'targetAddress',
        value: 'Please specify a valid account address',
      });
    });

    it('empty address', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.targetAddress = '';
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toEqual({
        field: 'targetAddress',
        value: 'Please specify a valid account address',
      });
    });

    it('zero address is fine', async () => {
      const invalidData = updateImmutably(newFormData, (data) => {
        data.targetAddress = constants.AddressZero;
      });

      const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
      expect(encoded[GO_ERROR_INDEX]).toBe(null);
    });
  });

  it('checks for positive ETH amount', async () => {
    const invalidData = updateImmutably(newFormData, (data) => {
      data.targetValue = '-0.12345';
    });

    const encoded = await encodeEvmScript(mockedProvider, invalidData, api3Agent);
    expect(encoded[GO_ERROR_INDEX]).toEqual({
      field: 'targetValue',
      value: 'Please enter valid non-negative ETH amount',
    });
  });

  test('decoding', async () => {
    const encoded = await encodeEvmScript(mockedProvider, newFormData, api3Agent);
    const metadata = decodeMetadata(encodeMetadata(newFormData))!;

    expect(await decodeEvmScript(mockedProvider, encoded[GO_RESULT_INDEX]!, metadata)).toEqual({
      targetAddress: '0xB97F3A052d5562437e42EDeEBd1afec2376666eD',
      value: utils.parseEther('12'),
      parameters: ['arg1', '123'],
    });
  });
});

describe('proposal type and id', () => {
  test('encoding', () => {
    expect(encodeProposalTypeAndId('primary', '123')).toBe('primary-123');
  });

  test('decoding', () => {
    expect(decodeProposalTypeAndId('primary-123')).toEqual({ id: BigNumber.from(123), type: 'primary' });
  });

  test('decoding invalid value', () => {
    expect(decodeProposalTypeAndId('invalid-23notgood')).toBe(null);
    expect(decodeProposalTypeAndId('primary-1-5')).toBe(null);
    expect(decodeProposalTypeAndId('secondary-23notgood')).toBe(null);
    expect(decodeProposalTypeAndId('primary-23-randomjunk')).toBe(null);
  });
});

describe('addresses in proposal parameters', () => {
  it('supports ENS names in parameters', async () => {
    const formDataWithAddress = updateImmutably(newFormData, (data) => {
      data.targetSignature = 'functionName(address)';
      data.parameters = JSON.stringify([MOCKED_ENS_ENTRY.ensName]);
    });

    const encoded = await encodeEvmScript(mockedProvider, formDataWithAddress, api3Agent);
    const metadata = decodeMetadata(encodeMetadata(formDataWithAddress))!;

    expect(await decodeEvmScript(mockedProvider, encoded[GO_RESULT_INDEX]!, metadata)).toEqual({
      targetAddress: '0xB97F3A052d5562437e42EDeEBd1afec2376666eD',
      value: utils.parseEther('12'),
      parameters: [MOCKED_ENS_ENTRY.ensName],
    });
  });

  it('supports addresses in parameters', async () => {
    const address = '0x4017F39E438ADA9F860E15030E6A6e4b7b1af8Ba';
    const formDataWithAddress = updateImmutably(newFormData, (data) => {
      data.targetSignature = 'functionName(address)';
      data.parameters = JSON.stringify([address]);
    });

    const encoded = await encodeEvmScript(mockedProvider, formDataWithAddress, api3Agent);
    const metadata = decodeMetadata(encodeMetadata(formDataWithAddress))!;

    expect(await decodeEvmScript(mockedProvider, encoded[GO_RESULT_INDEX]!, metadata)).toEqual({
      targetAddress: '0xB97F3A052d5562437e42EDeEBd1afec2376666eD',
      value: utils.parseEther('12'),
      parameters: [address],
    });
  });
});
