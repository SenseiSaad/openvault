#!/usr/bin/env python3
"""
List available Bedrock inference profiles
These are required for some cross-region models
"""
import boto3
import json
import os

# Use boto3's default credential chain (environment, profile, or IAM role).
region = os.getenv('AWS_REGION', 'ap-south-1')

bedrock = boto3.client(
    'bedrock',
    region_name=region
)

try:
    print("\n=== Available Inference Profiles ===\n")

    # List inference profiles
    response = bedrock.list_inference_profiles()

    profiles_by_model = {}
    for profile in response.get('inferenceProfileSummaries', []):
        profile_id = profile.get('inferenceProfileId', 'N/A')
        profile_name = profile.get('inferenceProfileName', 'N/A')
        models = profile.get('models', [])

        for model in models:
            model_id = model.get('modelArn', 'N/A').split('/')[-1]
            if model_id not in profiles_by_model:
                profiles_by_model[model_id] = []
            profiles_by_model[model_id].append({
                'profile_id': profile_id,
                'profile_name': profile_name
            })

    # Print profiles grouped by model
    for model_id, profiles in sorted(profiles_by_model.items()):
        print(f"\n{model_id}:")
        for profile in profiles:
            print(f"  Profile ID: {profile['profile_id']}")
            print(f"  Name: {profile['profile_name']}")
        print()

    print(f"Total inference profiles: {len(response.get('inferenceProfileSummaries', []))}")

except Exception as e:
    print(f"Error: {e}")
    print("\nNote: Inference profiles are used for cross-region model access.")
