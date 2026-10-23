#!/usr/bin/env python3
import boto3
import json
import os

# Use boto3's default credential chain (environment, profile, or IAM role).
region = os.getenv('AWS_REGION', 'ap-south-1')

# Create Bedrock client
bedrock = boto3.client(
    'bedrock',
    region_name=region
)

try:
    # List all foundation models
    response = bedrock.list_foundation_models()

    print("\n=== Available Bedrock Models ===\n")

    # Group models by provider
    models_by_provider = {}
    for model in response['modelSummaries']:
        provider = model['providerName']
        if provider not in models_by_provider:
            models_by_provider[provider] = []
        models_by_provider[provider].append({
            'modelId': model['modelId'],
            'modelName': model.get('modelName', 'N/A'),
            'inputModalities': model.get('inputModalities', []),
            'outputModalities': model.get('outputModalities', [])
        })

    # Print models grouped by provider
    for provider, models in sorted(models_by_provider.items()):
        print(f"\n{provider}:")
        print("-" * 60)
        for model in models:
            print(f"  Model ID: {model['modelId']}")
            print(f"  Name: {model['modelName']}")
            print(f"  Input: {', '.join(model['inputModalities'])}")
            print(f"  Output: {', '.join(model['outputModalities'])}")
            print()

    print(f"\nTotal models available: {len(response['modelSummaries'])}")

except Exception as e:
    print(f"Error: {e}")
    print("\nTroubleshooting:")
    print("1. Check your AWS credentials")
    print("2. Ensure Bedrock is available in your region")
    print("3. Verify your AWS account has Bedrock access")
