import React, { useEffect, useContext, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useMutation, gql, useQuery } from '@apollo/client';
import { loadStripe } from '@stripe/stripe-js';
import { BillingPlanCard } from './BillingPlanCard/BillingPlanCard'
import { basicPlan, startupPlan, enterprisePlan } from './BillingPlanCard/BillingConfig'

import styles from './Billing.module.scss';
import { SidebarContext } from '../../components/Sidebar/SidebarContext';

import Skeleton from 'react-loading-skeleton';
import { message } from 'antd';

const getStripePromiseOrNull = () => {
    const stripe_publishable_key = process.env.REACT_APP_STRIPE_API_PK
    if (stripe_publishable_key) {
        return loadStripe(stripe_publishable_key);
    }
    return null
}

const stripePromiseOrNull = getStripePromiseOrNull()

export const Billing = () => {
    const { organization_id } = useParams<{ organization_id: string }>();
    const { pathname } = useLocation();
    const [checkoutRedirectFailedMessage, setCheckoutRedirectFailedMessage] = useState<string>("")
    const [loading, setLoading] = useState<boolean>(false)

    const { setOpenSidebar } = useContext(SidebarContext);

    const {
        loading: billingLoading,
        error: billingError,
        data: billingData,
        refetch,
    } = useQuery<{ billingDetails: string }, { organization_id: number }>(
        gql`
            query GetBillingDetails($organization_id: ID!) {
                billingDetails(organization_id: $organization_id)
            }
        `,
        {
            variables: {
                organization_id: parseInt(organization_id)
            },
        }
    );

    const [createOrUpdateSubscription, { data }] = useMutation<
        { createOrUpdateSubscription: string },
        { organization_id: number; plan: string }
    >(
        gql`
            mutation CreateOrUpdateSubscription($organization_id: ID!, $plan: Plan!) {
                createOrUpdateSubscription(
                    organization_id: $organization_id 
                    plan: $plan
                ) 
            }
        `
    );

    useEffect(() => {
        setOpenSidebar(true);
    }, [setOpenSidebar]);

    useEffect(() => {
        const response = pathname.split('/')[3] ?? ''
        if (response === "success") {
            message.success("Billing change applied!", 5)
        }
        if (checkoutRedirectFailedMessage) {
            message.error(checkoutRedirectFailedMessage, 5)
        }
        if (billingError) {
            message.error(checkoutRedirectFailedMessage, 5)
        }
    }, [pathname, checkoutRedirectFailedMessage, billingError])

    const createOnSelect = (plan: string) => {
        return async () => {
            setLoading(true);
            createOrUpdateSubscription({
                variables: { organization_id: parseInt(organization_id), plan }
            }).then(r => {
                if (!r.data?.createOrUpdateSubscription) {
                    message.success("Billing change applied!", 5);
                }
                refetch().then(() => {
                    setLoading(false);
                });
            });
        }
    }

    if (data?.createOrUpdateSubscription && stripePromiseOrNull) {
        (async function () {
            const stripe = await stripePromiseOrNull;
            const result = stripe ? await stripe.redirectToCheckout({
                sessionId: data.createOrUpdateSubscription,
            }) : { error: "Error: could not load stripe client." };

            if (result.error) {
                // result.error is either a string message or a StripeError, which contains a message localized for the user.
                setCheckoutRedirectFailedMessage(typeof result.error === "string" ? result.error : typeof result.error.message ===
                    "string" ? result.error.message : "Redirect to checkout failed. This is most likely a network or browser error.")
            }
        })()
    }


    return (
        <div className={styles.billingPageWrapper}>
            <div className={styles.blankSidebar}></div>
            <div className={styles.billingPage}>
                <div className={styles.title}>Billing</div>
                <div className={styles.subTitle}>
                    Manage your billing information.
                </div>
                <div className={styles.billingPlanCardWrapper}>
                    {
                        billingLoading || loading ?
                            <Skeleton style={{ borderRadius: 8, marginRight: 20 }} count={3} height={300} width={275} /> :
                            <>
                                <BillingPlanCard current={billingData?.billingDetails === basicPlan.planName} billingPlan={basicPlan} onSelect={createOnSelect(basicPlan.planName)}></BillingPlanCard>
                                <BillingPlanCard current={billingData?.billingDetails === startupPlan.planName} billingPlan={startupPlan} onSelect={createOnSelect(startupPlan.planName)}></BillingPlanCard>
                                <BillingPlanCard current={billingData?.billingDetails === enterprisePlan.planName} billingPlan={enterprisePlan} onSelect={createOnSelect(enterprisePlan.planName)}></BillingPlanCard>
                            </>
                    }
                </div>
            </div>
        </div >
    );
};