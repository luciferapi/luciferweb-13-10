UPDATE referral_program_settings
SET referrer_reward_type = 'fixed',
    referrer_reward_amount = 10.00,
    referrer_reward_currency = 'INR',
    referee_reward_type = 'fixed',
    referee_reward_amount = 0.00,
    referee_reward_currency = 'INR',
    updated_at = CURRENT_TIMESTAMP(3)
WHERE program_id = 1;
