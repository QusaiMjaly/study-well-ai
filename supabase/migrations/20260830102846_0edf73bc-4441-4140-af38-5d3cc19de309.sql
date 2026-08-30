ALTER TABLE public.exercise_media ADD COLUMN IF NOT EXISTS difficulty text;

UPDATE public.exercise_media SET difficulty='intermediate' WHERE slug = ANY(string_to_array('barbell_bench_press,incline_barbell_press,decline_barbell_press,close_grip_bench_press,incline_dumbbell_press,decline_dumbbell_press,incline_cable_fly,cable_fly_mid,cable_fly_low_to_high,cable_fly_high_to_low,dumbbell_pullover,decline_push_up,diamond_push_up,chest_dip,single_arm_pulldown,straight_arm_pulldown,pull_up,neutral_grip_pull_up,chin_up,barbell_row,pendlay_row,t_bar_row,deadlift,romanian_deadlift,sumo_deadlift,rack_pull,single_leg_rdl,good_morning,barbell_overhead_press,arnold_press,landmine_press,cable_rear_delt_fly,upright_row,pike_push_up,incline_dumbbell_curl,spider_curl,zottman_curl,overhead_cable_extension,skullcrusher,tricep_dip,bodyweight_tricep_extension,close_grip_dumbbell_press,barbell_squat,front_squat,hack_squat,split_squat,bulgarian_split_squat,walking_lunge,barbell_lunge,hack_squat_wide,jump_squat,barbell_hip_thrust,kettlebell_swing,plank_shoulder_tap,cable_crunch,russian_twist,dumbbell_russian_twist,cable_woodchop,hanging_leg_raise,knee_raise,hollow_hold,v_up,farmers_carry,burpee,squat_thruster,box_jump,skater_hop,kettlebell_front_rack_carry,kettlebell_thruster,landmine_deadlift,landmine_woodchop,barbell_push_press,barbell_reverse_lunge,dips_parallel_bars,double_kettlebell_row,dumbbell_cossack_squat,dumbbell_overhead_press,dumbbell_push_press,dumbbell_reverse_lunge,dumbbell_skull_crushers,dumbbell_step_ups,front_barbell_squat,kettlebell_high_pull,kettlebell_push_press,kettlebell_russian_twist,kettlebell_swing_russian,landmine_front_squat,overhead_cable_curl,seated_good_morning,trap_bar_deadlift,alternating_dumbbell_bench_press,bench_dips_straight_legs,chest_supported_barbell_row,cross_body_mountain_climber,dead_bug_with_dumbbells,dual_cable_lat_pulldown,dual_cable_lateral_raise,dumbbell_stiff_leg_deadlift,kettlebell_swing_two_hand,neutral_grip_overhead_press,overhead_cable_tricep_extension,reverse_lunge_with_kettlebell,rope_overhead_tricep_extension,smith_machine_glute_bridge,smith_machine_squat_straight,bulgarian_split_squat_with_dumbbell,bulgarian_split_squat_with_kettlebell,cable_woodchop_low_to_high,chest_supported_row_t_bar,heel_elevated_dumbbell_goblet_squat,smith_machine_incline_bench_press,two_handed_dumbbell_skull_crusher,broad_jumps,butt_kickers,dumbbell_pullover_with_a_horizontal_grip,floor_press,oblique_crunches,shoulder_taps,barbell_curl_21s,burpee_no_jump,cable_preacher_curl,chest_and_shoulder,dumbbell_external_rotation,dumbbell_upper_cuts,explosive_knee_drive,jump_get_ups,high_cable_curl,incline_dumbbell_row,low_cable_crossover,preacher_hammer_curl,reverse_preacher_curl,bent_over_barbell_row,close_grip_plate_press,cross_body_hammer_curl,declined_push_up_56,dips_on_bench_2,dumbbell_floor_chest_press,full_range_push_ups,incline_dumbbell_lateral_raise,incline_dumbbell_reverse_fly,lying_barbell_front_raise,lying_barbell_skull_crusher,lying_dumbbell_skull_crusher,lying_ez_bar_curl,lying_overhead_triceps_extension,preacher_curl_ez_bar,reverse_cable_preacher_curl,reverse_grip_skull_crusher,seated_dumbbell_triceps_extension,smith_machine_good_morning,standing_high_cable_row,standing_low_cable_row,one_arm_dumbbell_row_bench,reverse_grip_bent_over_rows',','));

UPDATE public.exercise_media SET difficulty='beginner' WHERE slug = ANY(string_to_array('dumbbell_bench_press,dumbbell_floor_press,machine_chest_press,incline_machine_press,smith_bench_press,dumbbell_chest_fly,machine_chest_fly,push_up,wide_push_up,incline_push_up,knee_push_up,lat_pulldown,lat_pulldown_neutral,close_grip_lat_pulldown,reverse_grip_pulldown,assisted_pull_up,seated_cable_row,low_cable_row,dumbbell_row,chest_supported_row,inverted_row,resistance_band_row,face_pull,dumbbell_rdl,back_extension,dumbbell_shrug,barbell_shrug,superman_hold,dumbbell_shoulder_press,seated_dumbbell_press,machine_shoulder_press,lateral_raise,cable_lateral_raise,machine_lateral_raise,front_raise,cable_front_raise,rear_delt_fly,pec_deck_fly,barbell_curl,ez_bar_curl,bicep_curl,alternating_dumbbell_curl,hammer_curl,concentration_curl,preacher_curl,cable_curl,cable_rope_curl,machine_bicep_curl,reverse_curl,tricep_pushdown,rope_pushdown,overhead_tricep_extension,tricep_kickback,bench_dip,single_arm_pushdown,squat,goblet_squat,dumbbell_squat,smith_machine_squat,leg_press,horizontal_leg_press,bodyweight_lunge,reverse_lunge,dumbbell_lunge,lateral_lunge,step_up,leg_extension,wall_sit,sumo_squat,leg_curl,seated_leg_curl,glute_bridge,dumbbell_hip_thrust,single_leg_glute_bridge,cable_kickback,glute_kickback_machine,donkey_kick,fire_hydrant,hip_abduction_machine,cable_hip_abduction,banded_lateral_walk,side_lying_leg_raise,calf_raise,seated_calf_raise,dumbbell_calf_raise,barbell_calf_raise,smith_calf_raise,leg_press_calf_raise,calf_raise_intervals,plank,side_plank,knee_plank,crunch,bicycle_crunch,reverse_crunch,oblique_crunch,sit_up,leg_raise,flutter_kick,scissor_kick,dead_bug,bird_dog,mountain_climber,toe_touch,half_burpee,jumping_jack,high_knees,kettlebell_goblet_squat,star_jump,seal_jack,kettlebell_deadlift,landmine_row,superman_raises,dumbbell_sumo_deadlift,dumbbell_upright_row,foward_lunges_bodyweight,hip_thrust_machine,kettlebell_floor_press,kettlebell_romanian_deadlift,kettlebell_sumo_deadlift,kettlebell_upright_row,reverse_lunges_bodyweight,seated_dumbbell_shrug,seated_knee_tucks,standing_cable_crunch,standing_leg_curl,bench_dips_bent_legs,bodyweight_squat_parallel_depth,dead_bug_legs_only,decline_chest_press_machine,side_bend_with_dumbbells,glute_bridge_on_bench,goblet_squat_with_kettlebell,kettlebell_goblet_box_squat,seated_machine_chest_press,leg_press_high_foot_placement,neutral_grip_dumbbell_bench_press,russian_twist_feet_on_floor,seated_dumbbell_rear_delt_fly,cable_deadlift,straight_leg_raise_bend_and_extend,barbell_front_raise,flat_cable_fly,glute_bridge_bodyweight,inclined_push_up,machine_reverse_fly,seated_calf_raises,smith_machine_shrug,standing_cable_fly,standing_reverse_curl,incline_machine_shoulder_press,low_cable_rope_curl,seated_dumbbell_calf_raise,seated_high_row_machine,superman,treadmill_run,stationary_bike,jump_rope,walking',','));

UPDATE public.exercise_media SET difficulty='advanced' WHERE slug = 'ab_wheel_rollout';

UPDATE public.exercise_media SET difficulty='beginner' WHERE difficulty IS NULL AND is_active;

UPDATE public.exercise_media m SET category = v.fam, equipment = v.eq, primary_muscles = v.muscles FROM (VALUES
('push_up','push_up','bodyweight',ARRAY['chest','triceps','core']::text[]),
('squat','squat','bodyweight',ARRAY['quads','glutes']::text[]),
('bodyweight_lunge','lunge','bodyweight',ARRAY['quads','glutes']::text[]),
('plank','plank','bodyweight',ARRAY['core']::text[]),
('glute_bridge','bridge','bodyweight',ARRAY['glutes','hamstrings']::text[]),
('mountain_climber','plank','bodyweight',ARRAY['core']::text[]),
('burpee','conditioning','bodyweight',ARRAY['full_body']::text[]),
('jumping_jack','conditioning','bodyweight',ARRAY['full_body']::text[]),
('crunch','crunch','bodyweight',ARRAY['core']::text[]),
('sit_up','sit_up','bodyweight',ARRAY['core']::text[]),
('bicycle_crunch','crunch','mat',ARRAY['core']::text[]),
('russian_twist','rotation','bodyweight',ARRAY['core']::text[]),
('superman','core','bodyweight',ARRAY['core','glutes']::text[]),
('dead_bug','antiextension','mat',ARRAY['core']::text[]),
('high_knees','conditioning','bodyweight',ARRAY['full_body']::text[]),
('wall_sit','squat','bodyweight',ARRAY['quads']::text[]),
('tricep_dip','dip','bodyweight',ARRAY['triceps','chest']::text[]),
('pull_up','vertical_pull','bodyweight',ARRAY['back','biceps']::text[]),
('dumbbell_bench_press','horizontal_press','dumbbell',ARRAY['chest','triceps','shoulders']::text[]),
('dumbbell_shoulder_press','vertical_press','dumbbell',ARRAY['shoulders','triceps']::text[]),
('dumbbell_row','horizontal_pull','dumbbell',ARRAY['back','biceps']::text[]),
('bicep_curl','curl','dumbbell',ARRAY['biceps']::text[]),
('barbell_squat','squat','barbell',ARRAY['quads','glutes','core']::text[]),
('deadlift','hinge','barbell',ARRAY['back','hamstrings','glutes']::text[]),
('lat_pulldown','vertical_pull','machine',ARRAY['back','biceps']::text[]),
('leg_press','leg_press','machine',ARRAY['quads','glutes']::text[]),
('treadmill_run','conditioning','cardio',ARRAY['full_body']::text[]),
('stationary_bike','conditioning','cardio',ARRAY['quads','calves']::text[]),
('jump_rope','conditioning','bodyweight',ARRAY['calves','full_body']::text[]),
('walking','conditioning','cardio',ARRAY['full_body']::text[]),
('incline_dumbbell_press','incline_press','dumbbell',ARRAY['chest','shoulders']::text[]),
('dumbbell_chest_fly','fly','dumbbell',ARRAY['chest']::text[]),
('lateral_raise','lateral_raise','dumbbell',ARRAY['shoulders']::text[]),
('front_raise','front_raise','dumbbell',ARRAY['shoulders']::text[]),
('rear_delt_fly','rear_delt','dumbbell',ARRAY['shoulders','back']::text[]),
('seated_cable_row','horizontal_pull','cable',ARRAY['back','biceps']::text[]),
('hammer_curl','curl','dumbbell',ARRAY['biceps']::text[]),
('tricep_pushdown','pushdown','cable',ARRAY['triceps']::text[]),
('overhead_tricep_extension','extension','dumbbell',ARRAY['triceps']::text[]),
('romanian_deadlift','hinge','barbell',ARRAY['hamstrings','glutes','back']::text[]),
('leg_extension','leg_extension','machine',ARRAY['quads']::text[]),
('leg_curl','leg_curl','machine',ARRAY['hamstrings']::text[]),
('calf_raise','calf_raise','machine',ARRAY['calves']::text[])
) AS v(slug,fam,eq,muscles) WHERE m.slug = v.slug;