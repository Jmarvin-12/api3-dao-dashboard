import { BigNumber } from 'ethers';
import { useState } from 'react';
import { MAX_ALLOWANCE, useApi3Pool, useApi3Token } from '../../../contracts';
import { useChainData } from '../../../chain-data';
import { ModalFooter, ModalHeader } from '../../../components/modal/modal';
import Input from '../../../components/input/input';
import Button from '../../../components/button/button';
import { go, goSync, isUserRejection, formatApi3, parseApi3, messages } from '../../../utils';
import './forms.scss';

interface Props {
  allowance: BigNumber;
  balance: BigNumber;
  onClose: () => void;
}

const TokenDepositForm = (props: Props) => {
  const { allowance, balance } = props;

  const { setChainData, transactions, userAccount } = useChainData();
  const api3Token = useApi3Token();
  const api3Pool = useApi3Pool();

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  // The input field should catch any bad inputs, but just in case, try parse and display any errors
  const [parseErr, inputBigNum] = goSync(() => parseApi3(inputValue));

  const handleApprove = async () => {
    if (!api3Pool || !api3Token) return;

    setError('');

    const [err, tx] = await go(api3Token.approve(api3Pool.address, MAX_ALLOWANCE));
    if (err) {
      if (isUserRejection(err)) {
        // TODO: rather create a toast/notification
        setError(messages.TX_APPROVAL_REJECTED);
        return;
      }
      setError(messages.TX_APPROVAL_ERROR);
      return;
    }

    if (tx) {
      setChainData('Save deposit approval', { transactions: [...transactions, tx] });
    }
  };

  const handleDeposit = async () => {
    if (!api3Pool || !userAccount) return;

    if (!inputValue || inputValue === '0') {
      setError(messages.VALIDATION_INPUT_ZERO);
      return;
    }
    if (parseErr || !inputBigNum) {
      setError(messages.VALIDATION_INPUT_PARSE);
      return;
    }
    if (inputBigNum.gt(balance)) {
      setError(messages.VALIDATION_DEPOSIT_TOO_HIGH);
      return;
    }

    setError('');

    const [err, tx] = await go(api3Pool.deposit(userAccount, parseApi3(inputValue), userAccount));
    if (err) {
      if (isUserRejection(err)) {
        // TODO: rather create a toast/notification
        setError(messages.TX_DEPOSIT_REJECTED);
        return;
      }
      setError(messages.TX_DEPOSIT_ERROR);
      return;
    }

    if (tx) {
      setChainData('Save deposit transaction', { transactions: [...transactions, tx] });
    }

    props.onClose();
  };

  if (!api3Pool || !api3Token) {
    return null;
  }

  const approvalRequired = !parseErr && !!inputBigNum && inputBigNum.gt(allowance);
  const canDeposit = !parseErr && !!inputBigNum && !approvalRequired && inputBigNum.gt(0);

  return (
    <>
      <ModalHeader>How many tokens would you like to deposit?</ModalHeader>

      <div className="text-center">
        <p className="tokenAmountForm-token medium">TOKEN</p>
        <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} size="large" />
        {error && <p className="tokenAmountForm-error">{error}</p>}
        <div className="tokenDepositForm-balance">Your balance: {balance ? formatApi3(balance) : '0.0'}</div>
      </div>

      <ModalFooter>
        <div>
          <Button
            type={approvalRequired ? 'primary' : 'secondary'}
            onClick={handleApprove}
            disabled={!approvalRequired}
            className="tokenAmountForm-approve"
          >
            Approve
          </Button>

          <Button type={canDeposit ? 'primary' : 'secondary'} onClick={handleDeposit} disabled={!canDeposit}>
            Deposit
          </Button>
        </div>
      </ModalFooter>
    </>
  );
};

export default TokenDepositForm;