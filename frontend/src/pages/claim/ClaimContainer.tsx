import React, { useEffect, useContext } from 'react';
import {
    Page, PageTopPart, Row, Gap, ThemedText, ThemedButton, ErrorMessage, InputGroupAddon, ThemedLink,
    // @ts-ignore
} from 'unifyre-web-components';
import { ClaimProps, ClaimDispatch, Claim } from './Claim';
import { connect } from 'react-redux';
import { formatter } from '../../services/RatesService';
import { intl, ThemeContext, Theme } from 'unifyre-react-helper';
import { Utils } from '../../common/Utils';
import { useParams } from 'react-router';
import { IoIosCheckmarkCircle } from 'react-icons/io';
import { GiRocketFlight } from 'react-icons/gi';
import { useAlert } from 'react-alert';
import CopyToClipboard from 'react-copy-to-clipboard';

function ClaimComponent(props: ClaimProps&ClaimDispatch) {
    const theme = useContext(ThemeContext);
    const {linkId} = useParams();
    const linkIdQuery = Utils.getQueryparam('linkId');
    const {onClaim, onLoad, id} = props;
    const alert = useAlert();
    useEffect(() => {
        if (!id) {
            onLoad(linkIdQuery || linkId);
        } else {
            onClaim(props, id);
        }
    }, [linkIdQuery, linkId, onClaim, onLoad, id]);
    const redirect = props.redirectUrl ? (
            <Row withPadding >
                <ThemedButton text={intl('btn-continue')} onClick={() => props.onRedirect(props.redirectUrl!)} />
            </Row>
    ) : undefined;
    let details: any = undefined;
    if (props.alreadyClaimed) {
        details = (
            <>
                <Row withPadding centered>
                    <IoIosCheckmarkCircle
                        size={theme.get(Theme.Text.h1Size) as any * 4}
                        color={theme.get(Theme.Colors.textColor) as any}/>
                </Row>
                <Row withPadding centered>
                    <ThemedText.H2>{intl('link-is-claimed')}</ThemedText.H2>
                </Row>
                <Row withPadding center>
                    <ThemedText.H3>{intl('your-address')}</ThemedText.H3>
                </Row>
                <Row withPadding center>
                    <ThemedLink text={props.address}
                        onClick={() => window.location.href = props.addressUrl} />
                </Row>
                <Row withPadding center>
                    <ThemedText.P>{props.message}</ThemedText.P>
                </Row>
                {redirect}
            </>
        );
    } else if (props.filled) {
        details = (
            <>
                <Row centered>
                  <GiRocketFlight 
                        size={theme.get(Theme.Text.h1Size) as any * 6}
                        color={theme.get(Theme.Colors.textColor) as any}/>
                </Row>
                <Row withPadding centered>
                    <ThemedText.H3>{intl('link-is-fully-claimed')}</ThemedText.H3>
                </Row>
                <Row withPadding centered>
                    <ThemedText.P>{props.message}</ThemedText.P>
                </Row>
                {redirect}
            </>
        );
    }
    if (props.cancelled) {
        details = (
            <>
                <Row withPadding centered>
                    <ThemedText.H3>{intl('link-is-cancelled')}</ThemedText.H3>
                </Row>
            </>
        );
    } else if (props.filled && !props.isOwner) {
        details = (
            <>
                <Row withPadding centered>
                    <ThemedText.H3>{intl('link-is-fully-claimed')}</ThemedText.H3>
                </Row>
            </>
        );
    } else if (props.isOwner) {
        if (props.executed) {
            details = (
                <>
                    <Row withPadding center>
                        <ThemedText.H2>{intl('link-is-executed')}</ThemedText.H2>
                    </Row>
                    <Row withPadding center>
                        <ThemedText.H3>{intl('transaction-ids')}</ThemedText.H3>
                    </Row>
                    {
                        props.transacctionIds.map((tid, idx) => (
                            <Row withPadding center key={idx}>
                                <ThemedLink text={Utils.shorten(tid)} onClick={() => {
                                    window.open(Utils.linkForTransaction(props.network, tid), '_blank')
                                }} />
                            </Row>
                        ))
                    }
                </>
            );
        } else {
            details = (
                <>
                    <Row withPadding center>
                        <ThemedText.H3>{intl('total-amount')}</ThemedText.H3>
                    </Row>
                    <Row withPadding center>
                        <InputGroupAddon
                            value={`${props.total} ${props.symbol}`}
                            disabled={true}
                        />
                    </Row>
                    <Row withPadding center>
                        <ThemedText.H3>{intl('claimed')}</ThemedText.H3>
                    </Row>
                    <Row withPadding center>
                        <InputGroupAddon
                            value={intl('claimed-out-of', {count: props.claimedCount, total: props.claimedTotal})}
                            disabled={true}
                        />
                    </Row>
                    <Row withPadding center>
                        <ThemedText.H3>{intl('pool-drop-link')}</ThemedText.H3>
                    </Row>
                    <Row withPadding>
                        <InputGroupAddon value={props.linkUrl} disabled={true}/>
                    </Row>
                    <Row withPadding>
                        <CopyToClipboard text={props.linkUrl}>
                            <ThemedButton text={intl('btn-copy-to-clipboard')}
                                highlight={true}
                                onClick={() => alert.success(intl('copied'))} />
                        </CopyToClipboard>
                    </Row>
                    <Gap />
                    <Row withPadding>
                        <ThemedButton text={intl('btn-sign')} onClick={() => props.onSign(props.id)} />
                    </Row>
                    <Row withPadding centered>
                        <ThemedLink text={intl('cancel-link')} onClick={() => props.onCancel(props.id)} />
                    </Row>
                </>
            );
        }
    }

    if (props.error) {
        details = (
            <>
            <Gap />
            <Row withPadding centered>
                <ErrorMessage text={props.error} />
            </Row>
            </>
        )
    }

    return (
        <Page>
            <PageTopPart>
                <Gap />
                <Gap />
                <Row centered withPadding>
                    <ThemedText.H3>{intl('pool-drop')} {props.symbol}
                    </ThemedText.H3>
                </Row>
                <Row centered withPadding>
                    <ThemedText.H2>{formatter.format(props.amount, false)} {props.symbol}
                    </ThemedText.H2>
                </Row>
            </PageTopPart>
            <Gap />
            {details}
            <Gap />
            <Gap />
            <Gap />
        </Page>
    );
}

export const ClaimContainer = connect(Claim.mapStateToProps, Claim.mapDispatchToProps)(ClaimComponent);