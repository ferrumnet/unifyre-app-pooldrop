import React, {useEffect} from 'react';
import { DashboardDispatch, Dashboard } from './Dashboard';
import { Switch, Route, useHistory } from 'react-router-dom';
import {
    Page, Row, ThemedText, Gap,
    // @ts-ignore
} from 'unifyre-web-components';
import { connect } from 'react-redux';
import { DashboardProps } from '../../common/RootState';
import { intl } from 'unifyre-react-helper';
import { Utils } from '../../common/Utils';
import { ClaimContainer } from '../claim/ClaimContainer';
import { PoolDropCreateContainer } from '../poolDropCreate/PoolDropCreateContainer';

function DashboardComponent(props: DashboardProps&DashboardDispatch) {
    const {onLoad} = props;
    const history = useHistory();
    const {activePoolDrop} = props;
    useEffect(() => {
        onLoad();
    }, [onLoad]);
    const linkId = Utils.getQueryparam('linkId');
    useEffect(() => {
      if (activePoolDrop && !linkId) {
        history.replace(`/claim/${activePoolDrop}`);
      }
    }, [activePoolDrop, linkId, history]);
    if (props.initialized) {
        // Render the routes
        return (
            <>
              <Switch>
                <Route path='/claim/:linkId'>
                  <ClaimContainer />
                </Route>
                <Route path='/'>
                  {!!linkId ? <ClaimContainer /> : <PoolDropCreateContainer />}
                </Route>
              </Switch>
            </>
        );
    }

    const fatalError = props.fatalError ? (
      <>
        <Row withPadding centered>
          <ThemedText.H2 >{intl('fatal-error-heading')}</ThemedText.H2>
        </Row>
        <Row withPadding centered>
          <ThemedText.H3 >{props.fatalError}</ThemedText.H3>
        </Row>
      </>
    ) : (
      <Row withPadding centered>
          <ThemedText.H2>Connecting...</ThemedText.H2>
      </Row>
    );

    return (
        <Page>
            <Gap />
            <Gap />
            <Gap />
            <Gap />
            {fatalError}
        </Page>
    );
}

export const DashboardContainer = connect(
  Dashboard.mapStateToProps, Dashboard.mapDispatchToProps)(DashboardComponent);