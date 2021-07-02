import { useState } from 'react';
import Button from '../../components/button/button';
import Layout from '../../components/layout/layout';
import { Modal } from '../../components/modal/modal';
import BorderedBox, { Header } from '../../components/bordered-box/bordered-box';
import TooltipChecklist from '../../components/tooltip/tooltip-checklist';
import Treasury from '../proposal-commons/treasury/treasury';
import { useApi3Token, useApi3Voting, useApi3AgentAddresses } from '../../contracts';
import { useActiveProposals, useLoadGenesisEpoch } from '../../logic/proposals/hooks';
import { encodeEvmScript, encodeMetadata, NewProposalFormData } from '../../logic/proposals/encoding';
import ProposalList from '../proposal-commons/proposal-list';
import NewProposalForm from './forms/new-proposal-form';
import { useTreasuryAndDelegation } from '../../logic/treasury-and-delegation/use-treasury-and-delegation';
import {
  openProposalsSelector,
  canCreateNewProposalSelector,
  votingPowerThresholdSelector,
} from '../../logic/proposals/selectors';
import Delegation from './delegation';
import { useChainData } from '../../chain-data';
import { useLoadDashboardData } from '../../logic/dashboard';
import { notifications } from '../../components/notifications/notifications';
import { formatApi3, go, GO_RESULT_INDEX, images, isGoSuccess, isUserRejection, messages, round } from '../../utils';
import styles from './proposals.module.scss';

const Proposals = () => {
  // TODO: Retrieve only "userVotingPower" from the chain instead of loading all staking data (and remove useLoadDashboardData call)
  const { proposals, delegation, dashboardState, isGenesisEpoch, transactions, setChainData } = useChainData();
  const api3Voting = useApi3Voting();
  const api3Token = useApi3Token();
  const api3Agent = useApi3AgentAddresses();

  const [openNewProposalModal, setOpenNewProposalModal] = useState(false);

  useLoadDashboardData();
  useLoadGenesisEpoch();

  useActiveProposals();
  useTreasuryAndDelegation();

  const sortedProposals = openProposalsSelector(proposals);
  const createNewProposal = canCreateNewProposalSelector(delegation, dashboardState, isGenesisEpoch);
  const votingThresholdPercent = votingPowerThresholdSelector(delegation);

  const thresholdPowerText = votingThresholdPercent ? formatApi3(votingThresholdPercent) : null;

  const votingPower = createNewProposal?.totalVotingPowerPercentage
    ? round(createNewProposal.totalVotingPowerPercentage, 2)
    : 0;

  const delegatedPowerText = createNewProposal?.delegatedVotingPowerPercentage
    ? ` (${round(createNewProposal.delegatedVotingPowerPercentage, 2)}% delegated)`
    : '';

  const newProposalChecklistItems = [
    {
      checked: createNewProposal?.lastProposalEpochOver ?? false,
      label: "You haven't created a proposal in the last 7 days.",
    },
    {
      checked: createNewProposal?.hasEnoughVotingPower ?? false,
      label: thresholdPowerText
        ? `You need at least ${thresholdPowerText}% of the total vote representation to post a proposal. You represent ${votingPower}% of the total voting power${delegatedPowerText}.`
        : 'You need to have enough voting power.',
    },
  ];

  // Only display this message during the genesis epoch
  if (createNewProposal?.genesisEpochOver) {
    newProposalChecklistItems.unshift({ checked: false, label: 'The genesis epoch is over.' });
  }

  // The button should always be in sync with the checklist
  const canCreateNewProposal = newProposalChecklistItems.every((item) => item.checked);

  const onCreateProposal = async (formData: NewProposalFormData) => {
    if (!api3Token || !api3Voting || !api3Agent) return null;

    const goEncodeEvmScript = encodeEvmScript(formData, api3Agent);
    // Should not happen, because user will not be allowed to press the create proposal button if there are errors
    if (!isGoSuccess(goEncodeEvmScript)) return null;

    // NOTE: For some reason only this 'ugly' version is available on the contract
    const [err, tx] = await go(
      api3Voting[formData.type]['newVote(bytes,string,bool,bool)'](
        goEncodeEvmScript[GO_RESULT_INDEX],
        encodeMetadata(formData),
        true,
        true
      )
    );

    if (err) {
      if (isUserRejection(err)) {
        notifications.info({ message: messages.TX_GENERIC_REJECTED });
        return;
      }
      notifications.error({ message: messages.TX_GENERIC_ERROR, errorOrMessage: err });
      return;
    }

    if (tx) {
      setChainData('Save new vote transaction', { transactions: [...transactions, { type: 'new-vote', tx }] });
    }

    setOpenNewProposalModal(false);
  };

  return (
    <Layout title="Governance">
      <div className={styles.proposalsHeader}>
        <Delegation />
        <Treasury />
      </div>

      <BorderedBox
        header={
          <Header>
            <h5>Active proposals</h5>
            <div>
              <Button onClick={() => setOpenNewProposalModal(true)} size="large" disabled={!canCreateNewProposal}>
                + New proposal
              </Button>
              <TooltipChecklist items={newProposalChecklistItems}>
                <img src={images.help} alt="new proposal help" className={styles.help} />
              </TooltipChecklist>
            </div>
          </Header>
        }
        content={<ProposalList proposals={sortedProposals} type="active" />}
        noMobileBorders
      />
      <Modal open={openNewProposalModal} onClose={() => setOpenNewProposalModal(false)} size="large">
        <NewProposalForm
          onClose={() => setOpenNewProposalModal(false)}
          onConfirm={onCreateProposal}
          api3Agent={api3Agent!}
        />
      </Modal>
    </Layout>
  );
};

export default Proposals;
