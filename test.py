import pandas as pd
df = pd.read_csv("data/uploads/patients.csv")
print(df.dtypes)
print(df.head(1).to_dict())