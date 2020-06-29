import React from 'react';
import { PoolDropCreateProps, PoolDropCreateDispatch, PoolDropCreate } from './PoolDropCreate';
import {
    Page, PageTopPart, Row, Gap, ThemedText, ThemedButton, InputGroupAddon, ErrorMessage,
    // @ts-ignore
} from 'unifyre-web-components';
import { intl } from 'unifyre-react-helper';
import { connect } from 'react-redux';
import { useHistory } from 'react-router';
import { formatter } from '../../services/RatesService';

function PoolDropCreateComponent(props: PoolDropCreateProps&PoolDropCreateDispatch) {
    const history = useHistory();
    const error = props.error ? (
        <Row withPadding>
            <ErrorMessage text={props.error} />
        </Row>
    ) : undefined;
    const balance = (
        <>
            <Gap />
            <Row withPadding centered>
                <ThemedText.H3>{intl('balance')}</ThemedText.H3>
            </Row>
            <Row withPadding centered>
                <ThemedText.H2>{formatter.format(props.balance, false)}</ThemedText.H2>
            </Row>
        </>
    );
    return (
        <Page>
            <PageTopPart>
                <Gap />
                <Row withPadding centered>
                    <ThemedText.H3>{intl('create-pool-drop')}</ThemedText.H3>
                </Row>
                <Row withPadding centered>
                    <ThemedText.H2>{props.symbol}</ThemedText.H2>
                </Row>
            </PageTopPart>
            <Gap />
            <Row withPadding>
                <ThemedText.SMALL>{intl('total-amount')}</ThemedText.SMALL>
            </Row>
            <Row withPadding>
                <InputGroupAddon
                    value={props.totalAmount}
                    onChange={props.onTotalAmountChanged}
                    inputMode={'decimal'}
                />
            </Row>
            {balance}
            <Row withPadding>
                <ThemedText.SMALL>{intl('number-of-participants')}</ThemedText.SMALL>
            </Row>
            <Row withPadding>
                <InputGroupAddon
                    value={props.numberOfParticipants}
                    onChange={props.onNumberOfParticipantsChanged}
                    inputMode={'decimal'}
                />
            </Row>
            <Row withPadding>
                <ThemedText.SMALL>{intl('amount-per-participant')}</ThemedText.SMALL>
            </Row>
            <Row withPadding>
                <InputGroupAddon
                    value={props.participationAmount}
                    disabled={true}
                />
            </Row>
            <Row withPadding>
                <ThemedText.SMALL>{intl('message-after-completion')}</ThemedText.SMALL>
            </Row>
            <Row withPadding>
                <InputGroupAddon
                    value={props.completedMessage}
                    onChange={props.onCompletedMessageChanged}
                />
            </Row>
            <Row withPadding>
                <ThemedText.SMALL>{intl('link-after-completion')}</ThemedText.SMALL>
            </Row>
            <Row withPadding>
                <InputGroupAddon
                    value={props.completedLink}
                    onChange={props.onCompletedLinkChanged}
                />
            </Row>
            {error}
            <Row withPadding>
                <ThemedButton text={intl('create-link')} onClick={() => props.onCreate(history, props)} />
            </Row>
            <Gap />
            <Gap />
            <Gap />
        </Page>
    );
}

export const PoolDropCreateContainer = connect(PoolDropCreate.mapStateToProps, PoolDropCreate.mapDispatchToProps) (
    PoolDropCreateComponent
);